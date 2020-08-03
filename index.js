const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

const bcrypt = require('bcrypt');
var atob = require('atob');

app.use(bodyParser.json());
app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    if (req.method == 'OPTIONS') {
        res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,PATCH");
        return res.status(200).json({});
    }
    next();
})

const dotenv = require('dotenv');
dotenv.config();

let jwt = require('jsonwebtoken');
let reference = 0;


const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
// const dbURL = "mongodb://localhost:27017";
const dbURL = `mongodb+srv://Nishu1234:nish34248@cluster0.fsljb.mongodb.net/Services?retryWrites=true&w=majority`

const nodemailer = require('nodemailer');
const ObjectId = mongodb.ObjectID;

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

let mailOptions = {
    from: process.env.EMAIL,
    to: '',
    subject: 'Sending Email using Node.js',
    html: `<h1>Hi from node</h1><p> Messsage</p>`
};

async function authenticate(req, res, next) {
    if (req.headers.authorization == undefined) {
        res.status(401).json({
            message: "No token present"
        })
    } else {
        jwt.verify(req.headers.authorization, 'pkngrdxawdvhilpkngrdxawdvhil', (err, decoded) => {
            if (err) {
                res.status(401).json({
                    message: "Session Expired,Please Login again"
                })
                return;
            } else {
                req.userType = decode.userType;
                req.accessRights = decode.accessRights
                next();
            }
        })
    }
}

function permission(allowedUsers) {
    console.log("permission-argument", allowedUsers);
    const isAllowed = type => allowedUsers.indexOf(type) > -1;
    console.log("permission", isAllowed);
    return (req, res, next) => {
        if (isAllowed(req.userType)) {
            next();
        } else {
            res.status(401).json({
                message: 'Not authorized to access'
            })
        }
    }
}

app.listen(port, () => {
    console.log("listening in port " + port);
});


app.post('/register', async (req, res) => {
    if (req.body.email == undefined || req.body.password == undefined || req.body.firstName == undefined || req.body.lastName == undefined || req.body.userType == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    } else {
        let company = req.body.email.split("@");
        company = company[1].split(".")[0];
        // req.body.password = atob(req.body.password);
        let client = await mongoClient.connect(dbURL).catch((err) => { throw err; });
        let db = client.db("Services");
        let data = await db.collection("customers").findOne({ email: req.body.email }).catch((err) => { throw err; });
        if (data) {
            client.close();
            res.status(400).json({
                message: "E-mail already exists"
            })
        } else {
            let data = await db.collection('customers').findOne({ company }).catch((err) => { throw err; });
            if (data) {
                res.status(400).json({
                    message: 'Company name already registered.....Please choose different name'
                });
            }
            else {
                let saltRounds = req.body.email.length;
                if (saltRounds > 12) {
                    saltRounds = 12;
                }
                let salt = await bcrypt.genSalt(saltRounds).catch((err) => { throw err; });
                let hash = await bcrypt.hash(req.body.password, salt).catch((err) => { throw err; });

                req.body.password = hash;
                req.body.accountVerified = false;
                req.body.isRootUser = true;
                req.body.dbName = email;
                delete req.body.confirmPassword;
                // req.body.isVerified = false;
                let data1 = await db.collection("customers").insertOne(req.body).catch((err) => { throw err; });
                let buf = await require('crypto').randomBytes(32);
                let token = buf.toString('hex');
                // console.log(token);
                let expiryInHour = 120;
                let timestamp = new Date();
                let expiry = expiryInHour * 60 * 60 * 1000;
                let data2 = await db.collection("customers").update({ email: req.body.email }, { $set: { verificationToken: token, verificationExpiry: expiry, verificationTimestamp: timestamp } });
                mailOptions.to = req.body.email;
                mailOptions.subject = 'CRM-Account verification '
                mailOptions.html = `<html><body><h1>Account Verification Link</h1>
                                 <h3>Click the link below to verify the account</h3>
                                <a href='${process.env.urldev}/#/verifyaccount/${token}/${req.body.email}'>${process.env.urldev}/#/verifyaccount/${token}/${req.body.email}</a><br>
                                <p>The link expires in <strong>${expiryInHour / 24} Days</strong></p></body></html>`

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                        res.status(500).json({
                            message: "An error occured,Please try again later"
                        })
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.status(200).json({
                            message: `Registration Successfull,Verification mail sent to ${req.body.email}`,
                            email: req.body.email,
                            token,
                            timestamp,
                            expiry
                        })
                        client.close();
                    }
                });
            }
        }
    }
});

app.post("/login", (req, res) => {
    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "E-mail or password missing"
        })
    } else {
        let { email, password } = req.body;
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err; });
        let company = email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        let data = await db.collection('customers').findOne({ email }, { projection: { verificationToken: 0, passwordResetToken: 0 } }).catch(err => { throw err; });
        if (data) {
            if (data.accountVerified) {
                bcrypt.compare(password, data.password, function (err, result) {
                    if (err) throw err;
                    if (result) {
                        jwt.sign({ id: data["_id"], email: data["email"], userType: data["userType"], accessRights: data['accessRights'] }, 'qwertyuiopasdfghjkl', function (err, token) {
                            if (err) throw err;
                            client.close();
                            console.log("login successfull");
                            delete data['password'];
                            delete data['dbName'];
                            delete data['isRootUser'];
                            res.status(200).json({
                                message: "login successfull",
                                token,
                                email,
                                userType: data["userType"],
                                isRootUser: data["isRootUser"],
                                company: data["company"],
                                data
                            })
                        });
                    } else {
                        client.close();
                        console.log("password incorrect");
                        res.status(401).json({
                            message: "password incorrect"
                        })
                    }
                })
            } else {
                res.status(400).json({
                    message: 'verify your account to login'
                });
            }

        } else {
            client.close();
            res.status(400).json({
                message: 'User not found'
            })
        }
    }
    // // req.body.password = atob(req.body.password);
    // // console.log(req.body.password)
    // mongoClient.connect(dbURL, (err, client) => {
    //     if (err) throw err;
    //     let db = client.db("Services");
    //     db.collection("customers").findOne({ email: req.body.email }, (err, data) => {
    //         if (err) throw err;
    //         if (data) {
    //             bcrypt.compare(req.body.password, data.password, function (err, result) {
    //                 if (err) throw err;
    //                 // result == true
    //                 if (result) {
    //                     jwt.sign({ id: data['_id'], }, 'pkngrdxawdvhilpkngrdxawdvhil', { expiresIn: '10h' }, function (err, token) {
    //                         if (err) throw err;
    //                         // console.log(token);
    //                         client.close();
    //                         res.status(200).json({
    //                             message: "login successfull",
    //                             token,
    //                             email: data.email
    //                             // isVerified: data.isVerified,
    //                             // urls: data.urls
    //                         })
    //                     });
    //                 } else {
    //                     client.close();
    //                     res.status(401).json({
    //                         message: "password mismatch"
    //                     })
    //                 }
    //             });
    //         } else {
    //             client.close();
    //             res.status(400).json({
    //                 "message": "user not found"
    //             })
    //         }
    //     })
    // })
    // }
});

app.post('/accountverification', async (req, res) => {
    let { verificationToken, email } = req.body;
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
    let company = email.split("@");
    company = company[1].split(".")[0];
    let db = client.db('Services');
    let data = await db.collection('customers').findOne({ email, verificationToken }).catch(err => { throw err });
    if (data) {
        await db.collection('customers').updateOne({ email }, { $set: { verificationToken: '', accountVerified: true } });
        client.close();
        res.status(200).json({
            message: 'Account verification succesfull'
        });
    } else {
        res.status(400).json({
            message: 'Account Verification failes, retry again'
        });
    }
});

app.post('/forget', async (req, res) => {
    let { email } = req.body;
    console.log(email);
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err; });
    let company = email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let data = await db.collection('customers').findOne({ email }).catch(err => { throw err });
    // console.log(data);
    if (data) {
        let buf = await require('crypto').randomBytes(32);
        let expiryInHour = 2;
        let timestamp = new Date();
        let expiry = expiryInHour * 60 * 60 * 1000;
        let token = buf.toString('hex');
        await db.collection('customers').updateOne({ email }, { $set: { passwordResetToken: token, timestamp: timestamp, expiry: expiry } });
        client.close();
        mailOptions.to = email;
        mailOptions.subject = 'CRM-Password reset';
        mailOptions.html = `<html><body><h1>Reset Password link</h1>
                            <h3>Click the link below to redirect to password rest page</h3>
                            <a href='${process.env.urldev}/#/resetpassword/${token}/${req.body.email}'>${process.env.urldev}/#/resetpassword/${token}/${req.body.email}</a><br>
                            <p>The link expires in <strong>${expiryInHour} hrs</strong></p></body></html>`
        // <a href='https://urlshortener.netlify.app/#/resetpassword/${token}/${req.body.email}'>https://urlshortener.netlify.app/#/resetpassword/${token}/${req.body.email}</a>
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                res.status(500).json({
                    message: "An error occured,Please try again later"
                })
            } else {
                console.log('Email sent: ' + info.response);
                res.status(200).json({
                    message: `Verification mail sent to ${req.body.email}`,
                })
                client.close();
            }
        });

    } else {
        res.status(400).json({
            message: 'Email does not exist'
        });
    }
    // require('crypto').randomBytes(32, function (ex, buf) {
    //     var token = buf.toString('hex');
    //     // console.log(token);
    //     mongoClient.connect(dbURL, (err, client) => {
    //         if (err) throw err;
    //         let company = req.body.email.split("@");
    //         company = company[1].split(".")[0];
    //         let expiryInHour = 2;
    //         let timestamp = new Date();
    //         let expiry = expiryInHour * 60 * 60 * 1000;
    //         let db = client.db("Services");
    //         db.collection("customers").update({ email: req.body.email }, { $set: { reset_token: token, timestamp: timestamp, expiry: expiry } }, (err, data) => {
    //             if (err) throw err;
    //             mailOptions.to = req.body.email;
    //             mailOptions.subject = 'CRM-ACCOUNT-Password reset '
    //             mailOptions.html = `<html><body><h1>Reset Password link</h1>
    //                                 <h3>Click the link below to redirect to password rest page</h3>
    //                                 <a href='${process.env.urldev}/#/resetpassword/${token}/${req.body.email}'>${process.env.urldev}/#/resetpassword/${token}/${req.body.email}</a><br>
    //                                 <p>The link expires in <strong>${expiryInHour} hrs</strong></p></body></html>`
    //             // <a href='https://urlshortener.netlify.app/#/resetpassword/${token}/${req.body.email}'>https://urlshortener.netlify.app/#/resetpassword/${token}/${req.body.email}</a>
    //             transporter.sendMail(mailOptions, function (error, info) {
    //                 if (error) {
    //                     console.log(error);
    //                     res.status(500).json({
    //                         message: "An error occured,Please try again later"
    //                     })
    //                 } else {
    //                     console.log('Email sent: ' + info.response);

    //                     res.status(200).json({
    //                         message: `Verification mail sent to ${req.body.email}`,
    //                         email: req.body.email,
    //                         token,
    //                         timestamp,
    //                         expiry
    //                     })
    //                 }
    //             });
    //         })
    //     })
    // });
})

app.post('/resetpassword', (req, res) => {
    mongoClient.connect(dbURL, (err, client) => {
        if (err) throw err;
        let company = req.body.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        db.collection("customers").findOne({ email: req.body.email, passwordResetToken: req.body.token }, (err, data) => {
            if (err) throw err;
            if (data) {
                // req.body.password = atob(req.body.password);
                let saltRounds = req.body.email.length;
                if (saltRounds > 12) {
                    saltRounds = 12;
                }
                bcrypt.genSalt(saltRounds, function (err, salt) {
                    if (err) throw err;
                    bcrypt.hash(req.body.password, salt, function (err, hash) {
                        if (err) throw err;
                        // Store hash in your password DB.
                        req.body.password = hash;
                        db.collection("customers").update({ email: req.body.email, passwordResetToken: req.body.token }, { $set: { password: hash, passwordResetToken: '', timestamp: '', expiry: '' } }, (err, data) => {
                            if (err) throw err;
                            // console.log(data);
                            client.close();
                            res.status(200).json({
                                message: "Password Changed successfully"
                            })
                        })
                    });
                });

            } else {
                res.status(400).json({
                    message: "The email id or token is not valid"
                })
            }
        })
    })
});

//  -manager should get access to all the database
//  -admin/manager should allow the employee to create the service
//  -registered employee can access the service request as well he can create one
//  -non registered employee can only view the service request

//first a registerd employee is rising a service request and storing it in a DB

app.get("/getusers", [authenticate, accessVerification("view")], async (req, res) => {
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = req.body.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let users = await db.collection("customers").find({}, { projection: { _id: 0, email: 1, firstName: 1, lastName: 1 } }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        users
    });
});

app.get("/getusers/employees", [authenticate, accessVerification("view")], async (req, res) => {
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = req.body.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let users = await db.collection("customers").find({ userType: "employee" }, { projection: { _id: 0, email: 1, firstName: 1, lastName: 1 } }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        users
    });
});

app.get("/getusers/managers", [authenticate, accessVerification("view")], async (req, res) => {
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = req.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let managers = await db.collection("customers").find({ userType: "manager" }, { projection: { _id: 0, email: 1, firstName: 1, lastName: 1 } }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        managers
    });
});

app.put("/updateaccessrights", [authenticate, accessVerification("edit")], async (req, res) => {
    let { userId } = req.body;
    if (userId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        userId = new ObjectId(userId);
        delete req.body.userId;
        await db.collection('customers').updateOne({ "_id": userId }, { $set: req.body }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Access Righs updated'
        });
    }
});

app.put("/updateprofile", [authenticate], async (req, res) => {
    let { _id } = req.body;
    if (_id === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        _id = new ObjectId(_id);
        delete req.body['_id'];
        await db.collection('customers').updateOne({ _id }, { $set: req.body }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Profile updated'
        });
    }
});

app.put("/updateusertype", [authenticate, permission(["admin", "manager"])], async (req, res) => {
    let { userId, userType } = req.body;
    if (userId === undefined || userType === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        userId = new ObjectId(userId);
        let data = await db.collection('customers').find({ '_id': userId }).toArray().catch(err => { throw err });
        console.log(data);
        let oldUserType = data.userType;
        await db.collection('customers').updateOne({ '_id': userId }, { $set: { userType } }).catch(err => { throw err });
        // console.log(admins);
        mailOptions.to = data.email;
        mailOptions.subject = 'Lead status update';
        mailOptions.html = `<html><body><h1>Employee type changed</h1>
            <h3>Lead status updated from <b>${oldUserType}</b> to <b>${userType}</h3>`;
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Employee type chnage sent Email info ' + info.response);
            }
        });
        client.close();
        res.status(200).json({
            message: 'Lead Status updated'
        });
    }
});

function accessVerification(access) {
    const isAllowed = accessRights => accessRights.indexOf(access) > -1;
    console.log("isallowed", isAllowed);
    return (req, res, next) => {
        if (req.userType === "employee") {
            if (isAllowed(req.accessRights)) {
                next();
            } else {
                res.status(401).json({
                    message: 'Have no access'
                })
            }
        } else {
            next();
        }

    }
}

app.post('/register/addusers', [authenticate, permission(["admin", "manager"])], async (req, res) => {

    if (req.body.email == undefined || req.body.password == undefined || req.body.firstName == undefined || req.body.lastName == undefined || req.body.userType == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    }
    else {
        //connecting to the mongo
        let client = await mongoClient.connect(dbURL).catch((err) => { throw err; });
        let company = req.body.email.split("@");
        company = company[1].split(".")[0];
        req.body.company = company;
        let db = client.db("Services");
        let data = await db.collection("customers").findOne({ email: req.body.email }).catch((err) => { throw err; });
        if (data) {
            client.close();
            res.status(400).json({
                message: "E-mail already exists"
            });
        } else {
            let saltRounds = req.body.email.length;
            if (saltRounds > 12) {
                saltRounds = 12;
            }
            let salt = await bcrypt.genSalt(saltRounds).catch((err) => { throw err; });
            let hash = await bcrypt.hash(req.body.password, salt).catch((err) => { throw err; });

            req.body.password = hash;
            req.body.accountVerified = false;
            req.body.isRootUser = false;
            req.body.totalRevenue = 0;
            req.body.revenues = [];
            // req.body.isVerified = false;
            //req.body should contain email, firstname, lastname, accessrights, userType,isverififed
            let data1 = await db.collection("customers").insertOne(req.body).catch((err) => { throw err; });
            let buf = await require('crypto').randomBytes(32);
            let token = buf.toString('hex');
            // console.log(token);
            let expiryInHour = 120;
            let timestamp = new Date();
            let expiry = expiryInHour * 60 * 60 * 1000;
            let data2 = await db.collection("customers").update({ email: req.body.email }, { $set: { verificationToken: token, verificationExpiry: expiry, verificationTimestamp: timestamp } });
            mailOptions.to = req.body.email;
            mailOptions.subject = 'CRM-Account verification '
            mailOptions.html = `<html><body><h1>Account Verification Link</h1>
                                 <h3>Click the link below to verify the account</h3>
                                <a href='${process.env.urldev}/#/verifyaccount/${token}/${req.body.email}'>${process.env.urldev}/#/verifyaccount/${token}/${req.body.email}</a><br>
                                <p>The link expires in <strong>${expiryInHour / 24} Days</strong></p></body></html>`

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.status(500).json({
                        message: "An error occured,Please try again later"
                    })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.status(200).json({
                        message: `Registration Successfull,Verification mail sent to ${req.body.email}`,
                        email: req.body.email,
                        token,
                        timestamp,
                        expiry
                    })
                    client.close();
                }
            });
        }
    }

});

app.post("/changepassword", async (req, res) => {
    let { email, password } = req.body;
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let data = await db.collection('customers').findOne({ email }).catch(err => { throw err });
    if (data) {
        let saltRounds = 10;
        let salt = await bcrypt.genSalt(saltRounds).catch((err) => { throw err; });
        let hash = await bcrypt.hash(password, salt).catch((err) => { throw err; });
        password = hash;
        await db.collection('customers').updateOne({ email }, { $set: { password } }).catch(err => { throw err });
        res.status(200).json({
            message: 'Password changed successfully'
        });
    } else {
        res.status(400).json({
            message: 'Password changing failed, Try again'
        });
    }
    client.close();
});

app.post('/creatingLead', [authenticate, accessVerification("create")], async (req, res) => {

    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    }
    else {
        let { ownername, firstName, phone, lastName, company, email, leadStatus } = req.body;
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let db = client.db('Services');
        await db.collection('lead').insertOne(req.body).catch(err => { throw err });
        let managers = await db.collection('customers').find({ userType: "manager" }).toArray().catch(err => { throw err; });
        for (let i of managers) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Lead added';
            mailOptions.html = `<html><body><h1>New lead added</h1>
            <h3>Details of new lead</h3>
            <h5>Lead Owner : ${ownername}</h5>
            <h5>First Name : ${firstName}</h5>
            <h5>Owner Company : ${company}</h5>
            <h5>Email : ${email}</h5>
            <h5>Phone Number : ${phone}</h5>
            <h5>Lead Status : ${leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
        let admins = await db.collection('customers').find({ userType: "admin" }).toArray().catch(err => { throw err; });
        for (let i of admins) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Lead added';
            mailOptions.html = `<html><body><h1>New lead added</h1>
            <h3>Details of new lead</h3>
            <h5>Lead Owner : ${owner}</h5>
            <h5>First Name : ${firstName}</h5>
            <h5>Owner Company : ${company}</h5>
            <h5>Email : ${email}</h5>
            <h5>Phone Number : ${phone}</h5>
            <h5>Lead Status : ${leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
        client.close();
        res.status(200).json({
            message: 'Lead added'
        });
    }
});

app.put('/updatingLead', [authenticate, accessVerification("update")], async (req, res) => {
    let { leadId } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Lead ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let db = client.db('Services');
        leadId = new ObjectId(leadId);
        delete req.body.leadId;
        await db.collection('lead').updateOne({ "_id": leadId }, { $set: req.body }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Lead updated'
        });
    }
});

app.put("/updatingleadstatus", [authenticate, accessVerification("update")], async (req, res) => {
    let { leadId, leadStatus } = req.body;
    if (leadId === undefined || leadStatus === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    }
    else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { leadStatus } }).catch(err => { throw err });
        console.log(data);
        let managers = await db.collection('customers').find({ userType: "manager" }).toArray().catch(err => { throw err; });
        for (let i of managers) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Lead status update';
            mailOptions.html = `<html><body><h1>Lead Status Updated</h1>
            <p>Lead status updated from <b>${data[0].leadStatus}</b> to <b>${leadStatus}</p>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5>
            <h5>Lead Status : ${data[0].leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
        let admins = await db.collection('customers').find({ userType: "admin" }).toArray().catch(err => { throw err; });
        // console.log(admins);
        for (let i of admins) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Lead status update';
            mailOptions.html = `<html><body><h1>New Status updated</h1>
            <p>Lead status updated from <b>${data[0].leadStatus}</b> to <b>${leadStatus}</p>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5>
            <h5>Lead Status : ${leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
        client.close();
        res.status(200).json({
            message: 'Lead Status updated'
        });
    }
});

app.delete('/deletingLead/:id', [authenticate, accessVerification("delete")], async (req, res) => {
    let { leadId } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Lead ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let db = client.db('Services');
        leadId = new ObjectId(leadId);
        delete req.body.leadId;
        await db.collection('lead').deleteOne({ "_id": leadId }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Lead deleted'
        });
    }
});

app.delete("/deletingUser/:id", [authenticate, accessVerification("delete")], async (req, res) => {
    let userId = req.params.id;
    if (userId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        userId = new ObjectId(userId);
        delete req.body.userId;
        await db.collection('customers').deleteOne({ "_id": userId }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'user deleted'
        });
    }
});

app.put("/leadconfirmed", [authenticate, accessVerification("edit")], async(req, res) => {
    let { leadId, leadStatus, revenue } = req.body;
    if (leadId === undefined || leadStatus === undefined || revenue === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { leadStatus, qoutedRevenue: revenue, orderConfirmed: false } }).catch(err => { throw err });
        // console.log(data);
        let ownerData = await db.collection('customers').find({ email: data[0].owner }).toArray().catch(err => { throw err });
        // console.log(ownerData);
        let managers = await db.collection('customers').find({ email: ownerData[0].manager }).toArray().catch(err => { throw err; });
        for (let i of managers) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Lead confirmation initialized';
            mailOptions.html = `<html><body><h1>Lead confirmed</h1>
            <h3>Details of lead</h3>
            <h1>Revenue: $ ${revenue}</h1>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5>
            <h5>Lead Status : ${data[0].leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('lead status sent to manager  Email info: ' + info.response);
                }
            });
        }
        mailOptions.to = data[0].email;
        mailOptions.subject = 'Order Confirmation';
        mailOptions.html = `<h1>Order Confirmation Mail</h1>
            <p>Thank you for choosing our service,please confirm your order</p>
            <h3>Terms & Conditions</h3>
            <ul>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
                <li>jgchchytdyrdyrdy</li>
            </ul>
            <h1>Price: $ ${revenue}</h1>
            <a href="${process.env.urldev}/#/confirmorder/${company}/${data[0]['_id']}"><button>Click to confirm</button></a>
            `;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('lead status sent to admin  Email info ' + info.response);
            }
        });

        client.close();
        res.status(200).json({
            message: 'Lead confirmed'
        });
    }
});

app.post("/managerconfirmed", [authenticate, permission(["admin", "manager"])], async(req, res)=> {
    let { leadId, company } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('customers').updateOne({ email: data[0].owner }, [{ $set: { totalRevenue: { $sum: ["$totalRevenue", data[0].qoutedRevenue] } } }]).catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { orderConfirmed: true, leadStatus: 'Completed' } }).catch(err => { throw err });
        // console.log(data);
        let ownerData = await db.collection('customers').find({ email: data[0].owner }).toArray().catch(err => { throw err });
        mailOptions.to = data[0].email;
        mailOptions.subject = 'Order Confirmed';
        mailOptions.html = `<html><body><h1>Order confirmed </h1>
            <p>We are happy to inform you that your order is confirmed</p>
            <h6>Thank you..continue using our service</h6>`;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('lead status sent to manager  Email info: ' + info.response);
            }
        });

        mailOptions.to = data[0].owner;
        mailOptions.subject = 'Order Completed';
        mailOptions.html = `<h1>Order Confirmed by ${ownerData[0].managerName}(Manager)</h1>
            <p>Please follow up with your manager</p>
            <br><br>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5> `;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('lead status sent to admin  Email info ' + info.response);
            }
        });

        client.close();
        res.status(200).json({
            message: 'Order confirmed'
        });
    }
});

app.post("/managercancelled", [authenticate, permission(["admin", "manager"])], async(req, res)=> {
    let { leadId, company } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { orderConfirmed: false, leadStatus: 'Cancelled' } }).catch(err => { throw err });
        // console.log(data);
        let ownerData = await db.collection('customers').find({ email: data[0].owner }).toArray().catch(err => { throw err });
        // console.log(ownerData);
        mailOptions.to = data[0].owner;
        mailOptions.subject = 'Order Cancelled';
        mailOptions.html = `<html><body><h1>Order Cancelled </h1>
        <p>Your manager has cancelled the order ,please follow up</p>
        <br><br>
        <h3>Details of lead</h3>
        <h5>Lead Owner Email: ${data[0].owner}</h5>
        <h5>Lead Owner Name: ${data[0].ownerName}</h5>
        <h5>First Name : ${data[0].firstName}</h5>
        <h5>Last Name : ${data[0].lastName}</h5>
        <h5>Email : ${data[0].email}</h5>
        <h5>Company : ${data[0].company}</h5>
        <h5>Title : ${data[0].title}</h5>
        <h5>Phone Number : ${data[0].phone}</h5>
        <h5>Lead Status : ${data[0].leadStatus}</h5>`;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('cancelled lead sent to admin  Email info ' + info.response);
            }
        });

        client.close();
        res.status(200).json({
            message: 'Order Cancelled'
        });
    }
});

app.post("/orderconfirmed", async(req, res) => {
    let { leadId, company } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { orderConfirmed: true } }).catch(err => { throw err });
        // console.log(data);
        let ownerData = await db.collection('customers').find({ email: data[0].owner }).toArray().catch(err => { throw err });
        // console.log(ownerData);
        let managers = await db.collection('customers').find({ email: ownerData[0].manager }).toArray().catch(err => { throw err; });
        for (let i of managers) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Order Confirmed';
            mailOptions.html = `<html><body><h1>Order confirmed </h1>
            <p>The lead has confirmed the order ,please verify and close the lead</p>
            <h1>Revenue: $ ${data[0].qoutedRevenue}</h1>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5>
            <h5>Lead Status : ${data[0].leadStatus}</h5>
            <br>
            <h3>Verify and close the lead</h3>
            <br>
            <a href="${process.env.urldev}/#/verifyorder/${company}/${leadId}"><button>Verify</button></a>
            `;
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('lead status sent to manager  Email info: ' + info.response);
                }
            });
        }
        mailOptions.to = data[0].owner;
        mailOptions.subject = 'Order Confirmed';
        mailOptions.html = `<h1>Order Confirmed by lead</h1>
            <p>Please follow up with your manager</p>
            <br><br>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5> `;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('lead status sent to admin  Email info ' + info.response);
            }
        });

        client.close();
        res.status(200).json({
            message: 'Order confirmed'
        });
    }
});

app.post("/ordercancelled", async(req, res)=> {
    let { leadId, company } = req.body;
    if (leadId === undefined) {
        res.status(400).json({
            message: 'Required Fields missing'
        });
    } else {
        let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
        let db = client.db("Services");
        leadId = new ObjectId(leadId);
        let data = await db.collection('lead').find({ '_id': leadId }).toArray().catch(err => { throw err });
        await db.collection('lead').updateOne({ '_id': leadId }, { $set: { orderConfirmed: false, leadStatus: 'Cancelled' } }).catch(err => { throw err });
        // console.log(data);
        let ownerData = await db.collection('customers').find({ email: data[0].owner }).toArray().catch(err => { throw err });
        // console.log(ownerData);
        let managers = await db.collection('customers').find({ email: ownerData[0].manager }).toArray().catch(err => { throw err; });
        for (let i of managers) {
            mailOptions.to = i.email;
            mailOptions.subject = 'Order Cancelled';
            mailOptions.html = `<html><body><h1>Order Cancelled </h1>
            <p>The lead has cancelled the order ,please follow up</p>
            <h1>Revenue lost: $ ${data[0].qoutedRevenue}</h1>
            <br><br>
            <h3>Details of lead</h3>
            <h5>Lead Owner Email: ${data[0].owner}</h5>
            <h5>Lead Owner Name: ${data[0].ownerName}</h5>
            <h5>First Name : ${data[0].firstName}</h5>
            <h5>Last Name : ${data[0].lastName}</h5>
            <h5>Email : ${data[0].email}</h5>
            <h5>Company : ${data[0].company}</h5>
            <h5>Title : ${data[0].title}</h5>
            <h5>Phone Number : ${data[0].phone}</h5>
            <h5>Lead Status : ${data[0].leadStatus}</h5>`;
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('cancelled lead sent to manager  Email info: ' + info.response);
                }
            });
        }
        mailOptions.to = data[0].owner;
        mailOptions.subject = 'Order Cancelled';
        mailOptions.html = `<html><body><h1>Order Cancelled </h1>
        <p>The lead has cancelled the order ,please follow up</p>
        <br><br>
        <h3>Details of lead</h3>
        <h5>Lead Owner Email: ${data[0].owner}</h5>
        <h5>Lead Owner Name: ${data[0].ownerName}</h5>
        <h5>First Name : ${data[0].firstName}</h5>
        <h5>Last Name : ${data[0].lastName}</h5>
        <h5>Email : ${data[0].email}</h5>
        <h5>Company : ${data[0].company}</h5>
        <h5>Title : ${data[0].title}</h5>
        <h5>Phone Number : ${data[0].phone}</h5>
        <h5>Lead Status : ${data[0].leadStatus}</h5>`;
        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('cancelled lead sent to admin  Email info ' + info.response);
            }
        });

        client.close();
        res.status(200).json({
            message: 'Order Cancelled'
        });
    }
});

app.get('/listofLeads', [authenticate, accessVerification("view")], async (req, res) => {
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
    let company = req.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db('Services');
    let leads = await db.collection("lead").find().toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        leads
    });
});

app.get("/listofLeads/:id", [authenticate, accessVerification("view")], async (req, res) => {
    let leadId = req.params.id;
    leadId = new ObjectId(leadId);
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = req.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let leads = await db.collection("lead").find({ "_id": leadId }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        leads
    });
});

app.post('/creatingContact', [authenticate, accessVerification("create")], async (req, res) => {

    if (req.body.email == undefined || req.body.password == undefined || req.body.firstName == undefined || req.body.lastName == undefined || req.body.userType == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    } else {
        let { owner, firstName, phone, lastName, company, email, dob } = req.body;
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db('Services');
        await db.collection('contactlist').insertOne(req.body).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'contact created'
        });
    }
});

app.put('/updatingContact', [authenticate, accessVerification("update")], async (req, res) => {
    let { contactId } = req.body;
    if (contactId === undefined) {
        res.status(400).json({
            message: 'Required Contact ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db('Services');
        contactId = new ObjectId(contactId);
        delete req.body.contactId;
        await db.collection('contactlist').updateOne({ "_id": contactId }, { $set: req.body }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Contact updated'
        });
    }
});

app.delete('/deletingContact/:id', [authenticate, accessVerification("delete")], async (req, res) => {
    let { contactId } = req.body;
    if (contactId === undefined) {
        res.status(400).json({
            message: 'Required Contact ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let company = req.email.split("@");
        company = company[1].split(".")[0];
        let db = client.db('Services');
        contactId = new ObjectId(contactId);
        delete req.body.contactId;
        await db.collection('contactlist').deleteOne({ "_id": contactId }).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'Contact deleted'
        });
    }
});

app.get('/listofContacts', [authenticate, accessVerification("view")], async (req, res) => {
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
    let company = req.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db('Services');
    let contacts = await db.collection("contactlist").find({}).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        contacts
    });
});

app.get("/listofContacts/:id", [authenticate, accessVerification("view")], async(req, res) => {
    let contactId = req.params.id;
    contactId = new ObjectId(contactId);
    let client = await mongodb.connect(dbURL, { useUnifiedTopology: true }).catch(err => { throw err });
    let company = req.email.split("@");
    company = company[1].split(".")[0];
    let db = client.db("Services");
    let contact = await db.collection("contactList").find({ "_id": contactId }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        contact
    });
});