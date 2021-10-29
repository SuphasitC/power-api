const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://127.0.0.1:27017';
const app = express();
const port = 3000;

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

app.get('/', (req, res) => {
    MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            var myobj = { name: "Suphasit.C", address: "Rimmor 414", timestamp: Date.now() };
            dbo.collection("information").insertOne(myobj, function(err, res) {
                if (err) throw err;
                console.log("1 document inserted, timestamp = ", myobj.timestamp);
            });
            dbo.collection("information").find({}).toArray((err, docs) => {
                if (err) throw err;
                console.log(docs)
            })
        }
    );
    res.status(200).send('Inserted!');
});

app.listen(port, () => {
    console.log(`Power API is listening on port ${port}.`);
});