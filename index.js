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

function permission(req, res, next) {
    if (req.userType == undefined) {
        res.status(401).json({
          message: "Please provide with the employee roll",
        });
      } else {
        if ((req.userType == "manager") || (req.userType == "admin")) {
          next();
        } else {
          res.status(401).json({
            message: "Particular employee is not authorized to do this activity"
          });
        }
      }
}

app.listen(port, () => {
    console.log("listening in port " + port);
});


app.post('/register', async (req, res) => {
    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    } else {
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
            let saltRounds = req.body.email.length;
            if (saltRounds > 12) {
                saltRounds = 12;
            }
            let salt = await bcrypt.genSalt(saltRounds).catch((err) => { throw err; });
            let hash = await bcrypt.hash(req.body.password, salt).catch((err) => { throw err; });

            req.body.password = hash;
            req.body.isVerified = false;
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

app.post("/login", (req, res) => {
    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "E-mail or password missing"
        })
    } else {
        // req.body.password = atob(req.body.password);
        // console.log(req.body.password)
        mongoClient.connect(dbURL, (err, client) => {
            if (err) throw err;
            let db = client.db("Services");
            db.collection("customers").findOne({ email: req.body.email }, (err, data) => {
                if (err) throw err;
                if (data) {
                    bcrypt.compare(req.body.password, data.password, function (err, result) {
                        if (err) throw err;
                        // result == true
                        if (result) {
                            jwt.sign({ id: data['_id'], }, 'pkngrdxawdvhilpkngrdxawdvhil', { expiresIn: '10h' }, function (err, token) {
                                if (err) throw err;
                                // console.log(token);
                                client.close();
                                res.status(200).json({
                                    message: "login successfull",
                                    token,
                                    email: data.email
                                    // isVerified: data.isVerified,
                                    // urls: data.urls
                                })
                            });
                        } else {
                            client.close();
                            res.status(401).json({
                                message: "password mismatch"
                            })
                        }
                    });
                } else {
                    client.close();
                    res.status(400).json({
                        "message": "user not found"
                    })
                }
            })
        })
    }
});

app.post('/accountverification', async (req, res) => {
    let { verificationToken, email } = req.body;
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
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

app.post('/forget', (req, res) => {
    require('crypto').randomBytes(32, function (ex, buf) {
        var token = buf.toString('hex');
        // console.log(token);
        mongoClient.connect(dbURL, (err, client) => {
            if (err) throw err;
            let expiryInHour = 2;
            let timestamp = new Date();
            let expiry = expiryInHour * 60 * 60 * 1000;
            let db = client.db("Services");
            db.collection("customers").update({ email: req.body.email }, { $set: { reset_token: token, timestamp: timestamp, expiry: expiry } }, (err, data) => {
                if (err) throw err;
                mailOptions.to = req.body.email;
                mailOptions.subject = 'CRM-ACCOUNT-Password reset '
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
                            email: req.body.email,
                            token,
                            timestamp,
                            expiry
                        })
                    }
                });
            })
        })
    });
})

app.post('/resetpassword', (req, res) => {
    mongoClient.connect(dbURL, (err, client) => {
        if (err) throw err;
        let db = client.db("Services");
        db.collection("customers").findOne({ email: req.body.email, reset_token: req.body.token }, (err, data) => {
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
                        db.collection("customers").update({ email: req.body.email, reset_token: req.body.token }, { $set: { password: hash, reset_token: '', timestamp: '', expiry: '' } }, (err, data) => {
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
    let db = client.db("Services");
    let users = await db.collection("customers").find({}, { projection: { _id: 0, email: 1, firstName: 1, lastName: 1 } }).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        users
    });
})

function accessVerification(access) {
    const isAllowed = accessRights => accessRights.indexOf(access) > -1;
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

app.post('/addusers', [authenticate, permission], async (req, res) => {

    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    }
    else {
        var userType = "employee";
        //connecting to the mongo
        let client = await mongoClient.connect(dbURL).catch((err) => { throw err; });
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
            req.body.isVerified = false;
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
        let managers = await db.collection('users').find({ userType: "manager" }).toArray().catch(err => { throw err; });
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

app.put('/updatingLead', [authenticate, accessVerification("update")], async(req, res) => {
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

app.put("/updatingleadstatus", [authenticate, accessVerification("update")], async(req, res) => {
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
            transporter.sendMail(mailOptions, function(error, info) {
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
            transporter.sendMail(mailOptions, function(error, info) {
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

app.delete('/deletingLead/:id', [authenticate, accessVerification("delete")], async(req, res) => {
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

app.get('/listofLeads', [authenticate, accessVerification("view")], async(req, res) => {
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
    let db = client.db('Services');
    let leads = await db.collection("lead").find().toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        leads
    });
});

app.post('/creatingContact', [authenticate, accessVerification("create")], async(req, res) => {
    
    if (req.body.email == undefined || req.body.password == undefined) {
        res.status(400).json({
            message: "Email or password missing"
        })
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
        let db = client.db('Services');
        await db.collection('contactlist').insertOne(req.body).catch(err => { throw err });
        client.close();
        res.status(200).json({
            message: 'contact created'
        });
    }
});

app.put('/updatingContact', [authenticate, accessVerification("update")], async(req, res) => {
    let { contactId } = req.body;
    if (contactId === undefined) {
        res.status(400).json({
            message: 'Required Contact ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
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

app.delete('/deletingContact', [authenticate, accessVerification("delete")], async(req, res) => {
    let { contactId } = req.body;
    if (contactId === undefined) {
        res.status(400).json({
            message: 'Required Contact ID is missing'
        });
    } else {
        let client = await mongoClient.connect(dbURL).catch(err => { throw err });
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

app.get('/listofContacts', [authenticate, accessVerification("view")], async(req, res) => {
    let client = await mongoClient.connect(dbURL).catch(err => { throw err });
    let db = client.db('Services');
    let contacts = await db.collection("contactlist").find({}).toArray().catch(err => { throw err; });
    client.close();
    res.status(200).json({
        contacts
    });
});