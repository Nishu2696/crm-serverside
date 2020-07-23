const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
// const dbURL = "mongodb://localhost:27017";
const dbURL = `mongodb+srv://Nishu1234:nish34248@cluster0.fsljb.mongodb.net/Services?retryWrites=true&w=majority`

app.listen(port, () => {
    console.log("listening in port " + port);
});

//  -manager should get access to all the database
//  -admin/manager should allow the employee to create the service
//  -registered employee can access the service request as well he can create one
//  -non registered employee can only view the service request

//first a registerd employee is rising a service request and storing it in a DB

app.post('/createServiceRequest', async(req, res) => {
    //connecting to the mongo
    let client = await mongoClient.connect(dbURL).catch((err) => {throw err;});
    let db = client.db("Services");
    if(req.body.employeeroll != "unauthorizedemployee"){
        let customer = { 
            no: req.body.no,
            name: req.body.name, 
            address: req.body.address, 
            mobileno: req.body.mobileno 
        };
        let data = await db.collection("customers").insertOne(customer).catch((err) => {throw err;});
        client.close();
        if(data){
            res.status(200).json({
                message: "Customer Service request has been added"
            });
        }
        else{
            res.status(400).json({
                msg: "Contact your admin/manager to get authorized as an employee"
            });
        }
    }
    res.send("service request page");
});

app.post('/deleteServiceRequest', async(req, res) => {
    let client = await mongoClient.connect(dbURL).catch((err) => {throw err;});
    let db = client.db("Services");
    if((req.body.employeeroll == "admin") || (req.body.employeeroll == "manager") || (req.body.employeeroll == "authorizedemployee")){
        let data = await db.collection("customers").deleteOne({no: req.body.no}).catch((err) => {throw err;});
        client.close();
        if(data){
            res.status(200).json({
                message: "your request has been deleted"
            });
        }
        else{
            res.status(400).json({
                msg: "Contact your admin/manager to get authorized as an employee to perform this specified task"
            });
        }
    }
    res.send("request has been deleted");
});

app.post('/changeemployeestatus', async(req, res) => {
    let client = await mongoClient.connect(dbURL).catch((err) => {throw err;});
    let db = client.db("Services");
    if((req.body.employeeroll == "admin") || (req.body.employeeroll == "manager")){
        let data = await db.collection("customers").findOne({name: req.body.name}).catch((err) => {throw err;});
        if(data){
            let data1 = await db.collection("customers").updateOne({name: req.body.name}, {$set: {employeeroll: "authorizedemployee"}}).catch((err) => {throw err;});
            client.close();
            if(data1){
                res.status(200).json({
                    message: "employees status has been updated"
                });
            }
            else{
                res.status(400).json({
                    message: "employees status cannot be updated"
                });
            }
        }
        else{
            res.status(400).json({
                msg: "requested employee name cannot be found. Please enter a valid employee name"
            });
        }
    }
});

app.get("/viewRequests", async (req, res) => {
    let client = await mongoClient.connect(dbURL).catch((err) => {throw err;});
    let db = client.db("Services");
    let data = await db.collection("customers").find({}).toArray.catch((err) => {throw err;});
    client.close();
    if(data){
        res.status(200).json({
            message: data
        });
    }
});