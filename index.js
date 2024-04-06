const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://cars-doctor-e6235.web.app",
        "https://cars-doctor-e6235.firebaseapp.com"
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@dbcluster.equ9ury.mongodb.net/?retryWrites=true&w=majority&appName=DBCluster`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// custom middleware
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log('token got in middleware', token);
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decodedData) => {
        if (error) {
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decodedData;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const serviceCollection = client.db('cardoctor').collection('services');
        const bookingCollection = client.db('cardoctor').collection('bookings');

        // auth related api
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
            // console.log(token);
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: "none"
            }).send({ success: true })
        })

        app.post("/logout", async (req, res) => {
            const user = req.body;
            console.log("user on change", user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        // service related api
        app.get('/services', async (req, res) => {
            // const sort = req.query.sort;
            // console.log(sort);
            // const options = {
            //     sort: { price: sort === "asc" ? 1 : -1 }
            // }
            const cursor = serviceCollection.find({ title: {$regex: req.query.search, $options: "i"} });
            // const cursor = serviceCollection.find({ price: { $gt: 20, $lt: 250 } }, options);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };

            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        })

        // bookings 
        app.get('/bookings', verifyToken, async (req, res) => {
            console.log(req.query.email);
            console.log("token owner info", req.user);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            console.log(updatedBooking);
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`Car Doctor Server is running on port ${port}`)
})