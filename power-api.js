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

var devices = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <devices>
                            <id>MDB1-2</id>
                            <id>MDB1</id>
                            <id>MDB2</id>
                            <id>Solar3</id>
                            <id>Sol3</id>
                        </devices>`;

var devicesId = ['MDB1-2', 'MDB1', 'MDB2', 'Solar3', 'Sol3'];

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


var insertObjToDatabase = (obj) => {
    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection("information").insertOne(obj, function(err, res) {
                if (err) throw err;
            });
        }
    );
}

// async function findObjInDatabase (queryObj) {
//     await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
//         function(err, db) {
//             if (err) throw err;
//             var dbo = db.db("power-api");
//             dbo.collection("information").find(queryObj).toArray((err, docs) => {
//                 if (err) throw err;
//                 console.log(docs)
//                 return(docs);
//             });
//         }
//     );
// }

// var getData = async () => {
//     var id = devicesId[Math.floor(Math.random() * devicesId.length)];
//     try {
//         const response = await axios.get(`http://localhost:3000/devices/${id}`);
//         console.log(response);
//     } catch (error) {
//         console.error(error);
//     }
// }

// setInterval(() => {
//     getData();
// }, 3000);

var getTimeStamp = () => {
    var today = new Date();
    var day = insertZero(today.getDate() + "");
    var month = (insertZero(today.getMonth() + 1) + "");
    var year = insertZero(today.getFullYear() + "");
    var hour = insertZero(today.getHours() + "");
    var minute = insertZero(today.getMinutes() + "");
    var second = insertZero(today.getSeconds() + "");

    return {
        day: day,
        month: month,
        year: year,
        hour: hour,
        minute: minute,
        second: second
    }
}

var insertZero = (time) => {
    if(time.length == 1) {
        time = "0" + time;
    }
    return time;
}

//get devices list
app.get('/devices', cors(), (req, res) => {
    xml2js.parseString(devices, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4);
        var json = JSON.parse(jsonString);
        res.send(json);
    });
});

//get newest data of device
app.get('/devices/:deviceId', cors(), (req, res) => {
    var deviceId = req.params.deviceId;
    var queryObj = { id: deviceId };

    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection("information").find(queryObj).sort({ _id: -1 }).limit(1).toArray((err, value) => {
                if (err) throw err;
                console.log(value)
                res.send(value[0]);
            });
        }
    );
});

//fetch data and write in database
app.post('/devices/:deviceId', cors(), (req, res) => {
    var deviceId = req.params.deviceId;

    var dataFromPowerStudio = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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

    xml2js.parseString(dataFromPowerStudio, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4); //json string data from power studio
        var json = JSON.parse(jsonString); //json data from power studio
        const timeStamp = getTimeStamp();
        json = { id: deviceId, ...json, timeStamp };
        if (devicesId.includes(deviceId)) {
            insertObjToDatabase(json);
            console.log(json.values.variable[1].textValue[0]); //deviceId
            console.log(json.values.variable[4].value[0]); //value
            res.send(json);
        } else {
            res.status(400).send(`Not has this devices in the system.`);
        }
    });
});

//get all data of device
app.get('/devices/:id/all', async (req, res) => {
    var deviceId = req.params.id;
    var queryObj = { id: deviceId };
    try {
        MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
            function(err, db) {
                if (err) throw err;
                var dbo = db.db("power-api");
                dbo.collection("information").find(queryObj).toArray((err, docs) => {
                    if (err) throw err;
                    res.send(docs);
                });
            }
        );
    } catch (e) {
        console.log(e);
    }
});

app.get('/', (req, res) => {
    res.send('Power - API')
});

app.listen(port, () => {
    console.log(`Power API is listening on port ${port}.`);
});