require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./services/db");
const mongoose = require("mongoose");
const crypto = require("crypto");
const GridFsStorage = require("multer-gridfs-storage");
const multer = require("multer");
const Grid = require("gridfs-stream");
const path = require("path");

const PORT = process.env.PORT || 5000;

const app = express();

const init = async () => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(cors());

  await connectDB();

  // GridFs & Multer
  const conn = mongoose.connection;

  // create a stream connection with our cluster
  const gfs = await Grid(conn.db, mongoose.mongo);

  // name of the bucket where media is going to be retrieved
  gfs.collection("media");

  // specifying a storage location in our cluster for multer
  const storage = await new GridFsStorage({
    db: conn.db,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename =
            buf.toString("hex") + path.extname(file.originalname);
          const fileInfo = {
            filename,
            bucketName: "media",
          };
          return resolve(fileInfo);
        });
      });
    },
  });

  // initializing multer storage
  const upload = multer({ storage });

  // route for uploading a file
  app.post("/upload", upload.single("file"), (req, res) => {
    res.json(req.file);
  });

  // route for getting all the files from the media bucket
  app.get("/files", async (req, res) => {
    try {
      const files = await gfs.files.find().toArray();
      res.json(files);
    } catch (err) {
      res.status(400).send(err);
    }
  });

  // route for streaming a file
  app.get("/read/:filename", async (req, res) => {
    const { filename } = req.params;
    try {
      const readstream = await gfs.createReadStream({ filename });

      readstream.pipe(res);
    } catch (err) {
      res.status(400).send(err);
    }
  });

  // route for deleting a file
  app.delete("/delete/:filename", async (req, res) => {
    const { filename } = req.params;
    try {
      await gfs.files.remove({ filename });

      res.status(200).end();
    } catch (err) {
      res.status(400).send(err);
    }
  });

  app.get("/", (req, res) => {
    res.send("if you are seeing this message, the server is working");
  });
};

init();

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
