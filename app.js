// https://medium.com/swlh/how-to-upload-image-using-multer-in-node-js-f3aeffb90657#:~:text=Import%20express%2Cmulter%20and%20initialize%20port%20variable%20to%203000.&text=This%20will%20set%20image%20upload,general%20example%20and%20understand%20it.

import express from "express";
import fs from "fs";
import multer from "multer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
// morgan is a logger middleware
import morgan from "morgan";
import sharp from "sharp";

import { dirname } from "path";
import { fileURLToPath } from "url";

import compression from "compression";
import AppError from "./utils/appError.js";

import globalErrorHandler from "./controllers/errorController.js";
import catchAsync from "./utils/catchAsync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// app.use("/uploads", express.static("uploads"));
// https://stackoverflow.com/questions/69243166/err-blocked-by-response-notsameorigin-cors-policy-javascript
app.use(helmet({crossOriginResourcePolicy: false,}));

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

app.use("/imagev2api", limiter);

app.use(mongoSanitize());

app.use(hpp());

app.use(compression());

// const corsOptions ={
//   origin:'http://localhost:3000',
//   credentials:true,            //access-control-allow-credentials:true
//   optionSuccessStatus:200
// }
// give cross-origin permission to localhost:3000
// app.use(cors(corsOptions));

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
var upload = multer({ storage: storage });

// Ref: https://sharp.pixelplumbing.com/api-resize
app.get(
  "/uploads/:filename",
  catchAsync(async (req, res, next) => {
    console.log("req.query", req.query);
    // For url: uploads%2FDinakar_632461d1416122fc5212c05b_1664642928517.jpg&w=1920&q=75
    // extract w and q from query string
    // w - width, q - quality
    const { w, q } = req.query;

    const { filename } = req.params;
    const filePath = `${__dirname}/uploads/${filename}`;
    const file = fs.readFileSync(filePath);
    const image = sharp(file);
    if (w || q){
      // fit: cover scales the image to cover the provided dimensions, cropping any parts of the image that do not fit.
      image.resize({width: Number(w)});
      image.jpeg({quality: Number(q)});
    }
    image
      .toBuffer()
      .then((data) => {
        res.set("Content-Type", "image/jpeg");
        res.send(data);
      })
      .catch((err) => {
        return next(new AppError(`Error: ${err}`, 500));
      });
  })
);

app.get(
  "/",
  catchAsync(async (req, res, next) => {
    res.status(200).json({
      status: "success",
      message: "Welcome to the Image Upload API",
    });
  })
);

// https://stackoverflow.com/questions/58456389/how-to-call-my-middleware-for-all-apis-i-have-automatically
const verifyAPIKey = catchAsync(async (req, res, next) => {
  let api_key;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    api_key = req.headers.authorization.split(" ")[1];
  }

  if (!api_key) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    const isMatch = bcrypt.compare(
      api_key + process.env.SECRET_SALT,
      process.env.SECRET_API_ENCRYPTION_KEY
    );
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Denied access since API key is invalid" });
    }
    next();
  } catch (error) {
    return next(new AppError("Not authorized to access this route", 401));
  }
});

// https://stackoverflow.com/questions/31530200/node-multer-unexpected-field
app.post(
  "/imagev2api/profile-upload-single",
  verifyAPIKey,
  upload.single("profile-file"),
  catchAsync(async (req, res, next) => {
    // if we include upload.single('profile-file') inside the catchAsync, it will not work because it is not a promise
    //   request format: {
    //     "file-0": File,
    //     "file-1": File
    // }
    /*
    // The response must have a "result" array.
                "result": [
                    {
                      "url": src,
                      "name": files[0].name,
                      "size": files[0].size
                    },
    */
    console.log("File uploaded successfully");
    var response = {
      result: [
        {
          url: req.file.path,
          name: req.file.originalname,
          size: req.file.size,
        },
      ],
    };
    res.send(response);
  })
);

app.post(
  "/profile-upload-multiple",
  verifyAPIKey,
  upload.array("profile-files", 12),
  function (req, res, next) {
    // req.files is array of `profile-files` files
    // req.body will contain the text fields, if there were any
    var response = '<a href="/">Home</a><br>';
    response += "Files uploaded successfully.<br>";
    for (var i = 0; i < req.files.length; i++) {
      response += `<img src="${req.files[i].path}" /><br>`;
    }

    return res.send(response);
  }
);

app.delete(
  "/delete-file",
  verifyAPIKey,
  catchAsync(async (req, res, next) => {
    // http://localhost:3000/delete-file?filePath=uploads/1.jpg
    try {
      var filePath = req.query.filePath;

      console.log("filePath: ", filePath);

      filePath = `uploads/${filePath}`;
      // Delete file from uploads folder. For example if filePath is 'uploads/abc.jpg' then file 'abc.jpg' will be deleted from uploads folder.
      fs.unlink(filePath, function (err) {
        if (err) {
          return next(new AppError("File not found", 404));
        }
        console.log("File deleted!");
        return res.send("File deleted successfully.");
      });
    } catch (error) {
      return next(new AppError("Error deleting file", 500));
    }
  })
);

// app.use("/quotes", quoteRouter);

// https://stackoverflow.com/questions/50938016/express-js-middleware-executing-for-a-route-defined-above-it

//not available routes
app.all("*", (req, res, next) => {
  next(new AppError(`Cant find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
