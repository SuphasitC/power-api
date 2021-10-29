const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const xml2js = require('xml2js');
var cors = require('cors')
const axios = require('axios');

const app = express();
app.use(cors());

const mongoUrl = 'mongodb://127.0.0.1:27017';
const port = 3000;

const powerPort = 8080;
const powerUrl = 'http://127.0.0.1:' + powerPort;
/*
    1. get devices list then use gotten id to get value from .../variableValue every 3 seconds (export value to web socket)
    2. keep history (from 1.) every 1 minute (1 value/minute)
    3. get history (by filtered)
        - today (00.00 - now) -> 5 mins/15 mins/1 hour/raw (get all values eg. 5mins -> return 5 values, 1 hour -> return 60 values)
        - yesterday (00.00 - 23.59 of yesterday) -> 5 mins/15 mins/1 hour/raw
        - this week -> 1 day/5 mins/15 mins/1 hour/raw
        - this month -> 1 day/1 week/5 mins/15 mins/1 hour/raw
        - specific time (DateTime - DateTime) -> 5 mins/15 mins/1 hour/raw
*/

var devicesId = ['MDB1-2', 'MDB1', 'MDB2', 'Solar3', 'Sol3'];

var insertObjToDatabase = (obj) => {
    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection("information").insertOne(obj, function(err, res) {
                if (err) throw err;
            });
            // dbo.collection("information").find({}).toArray((err, docs) => {
            //     if (err) throw err;
            //     // console.log(docs)
            // });
        }
    );
}

var getData = async () => {
    var id = devicesId[Math.floor(Math.random() * devicesId.length)];
    try {
        const response = await axios.get(`http://localhost:3000/devices/${id}`);
        // console.log(response);
    } catch (error) {
        console.error(error);
    }
}

setInterval(() => {
    getData();
}, 3000);

app.get('/devices', cors(), (req, res) => {
    // async function getDevices() {
    //     try {
    //         const response = await axios.get(powerUrl + '/services/chargePointsInterface/devices.xml?api_key=special-key');
    //         console.log(response);
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }
    // getDevices();
    var response = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <devices>
                            <id>MDB1-2</id>
                            <id>MDB1</id>
                            <id>MDB2</id>
                            <id>Solar3</id>
                            <id>Sol3</id>
                        </devices>`
    xml2js.parseString(response, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4);
        var json = JSON.parse(jsonString);
        // console.log(json);
        res.send(json);
    });
});

app.get('/devices/:deviceId', cors(), (req, res) => {
    var deviceId = req.params.deviceId;
    // async function getDeviceValue() {
    //     try {
            // const response = await axios.get(powerUrl + `/services/chargePointsInterface/variableValue.xml?id=${deviceId}&api_key=special-key`);
    //         console.log(response);
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }
    // getDeviceValue();
    var response = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <values>
                        <variable>
                            <id>${deviceId}.DESCRIPTION</id>
                        </variable>
                        <variable>
                            <id>${deviceId}.NAME</id>
                            <textValue>${deviceId}</textValue>
                        </variable>
                        <variable>
                            <id>${deviceId}.PTIME</id>
                            <value>${Math.random() * 100000}</value>
                        </variable>
                        <variable>
                            <id>${deviceId}.STATUS</id>
                            <value>1.000000</value>
                        </variable>
                        <variable>
                            <id>${deviceId}.VDTTM</id>
                            <value>${Math.random() * 100000000000000}</value>
                        </variable>
                    </values>`
    xml2js.parseString(response, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4);
        const timeStamp =  Date.now() ;
        var json = JSON.parse(jsonString);
        json = { ...json, timeStamp };
        insertObjToDatabase(json);
        console.log(json)
        res.send(json);
    });
});

app.get('/', (req, res) => {
    res.send('eiei')
    // res.status(200).send('Inserted!');
});

app.listen(port, () => {
    console.log(`Power API is listening on port ${port}.`);
});