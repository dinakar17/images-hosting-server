// https://medium.com/swlh/how-to-upload-image-using-multer-in-node-js-f3aeffb90657#:~:text=Import%20express%2Cmulter%20and%20initialize%20port%20variable%20to%203000.&text=This%20will%20set%20image%20upload,general%20example%20and%20understand%20it.

var express = require("express");
var fs = require("fs");
var multer = require("multer");
var cors = require("cors");
var bodyParser = require("body-parser");
var dotenv = require("dotenv");
var hpp = require("hpp");
var helmet = require("helmet");
var bcrypt = require("bcryptjs");
var rateLimit = require("express-rate-limit");

dotenv.config();

var port = 5001;

var app = express();
app.use(cors());

// https://stackoverflow.com/questions/69243166/err-blocked-by-response-notsameorigin-cors-policy-javascript
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

app.use("/imagev2api", limiter);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(hpp());

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

// app.use(express.static(__dirname + "/public"));

app.use("/uploads", express.static("uploads"));

app.get("/", function (req, res) {
  // res.sendFile(__dirname + "/public/index.html");
  res.send("Image upload server is successfully up and running");
});

// https://stackoverflow.com/questions/58456389/how-to-call-my-middleware-for-all-apis-i-have-automatically
const verifyAPIKey = async (req, res, next) => {
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
    console.log(error);
    return res
      .status(401)
      .json({ message: "Denied access since API key is invalid" });
  }
};

// https://stackoverflow.com/questions/31530200/node-multer-unexpected-field
app.post(
  "/imagev2api/profile-upload-single",
  verifyAPIKey,
  upload.single("profile-file"),
  async function (req, res, next) {
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
  }
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

app.delete("/delete-file", verifyAPIKey, function (req, res) {
  // http://localhost:3000/delete-file?filePath=uploads/1.jpg
  var filePath = req.query.filePath;

  console.log("filePath: ", filePath);

  filePath = `uploads/${filePath}`;
  // Delete file from uploads folder. For example if filePath is 'uploads/abc.jpg' then file 'abc.jpg' will be deleted from uploads folder.
  fs.unlink(filePath, function (err) {
    if (err) {
      console.log(err);
      return res.status(500).send("Error deleting file.");
    }
    console.log("File deleted!");
    return res.send("File deleted successfully.");
  });
});

// app.use("/quotes", quoteRouter);

app.listen(port, () => console.log(`Server running on port ${port}!`));

// https://stackoverflow.com/questions/50938016/express-js-middleware-executing-for-a-route-defined-above-it
// app.use(async (req, res, next) => {
//   console.log(req.headers.authorization);
//   let api_key;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     api_key = req.headers.authorization.split(" ")[1];
//   }

//   if (!api_key) {
//     return res.status(401).json({
//       success: false,
//       message: "Not authorized to access this route",
//     });
//   }

//   try {
//     const isMatch = await bcrypt.compare(
//       api_key + process.env.SECRET_SALT,
//       process.env.SECRET_API_ENCRYPTION_KEY
//     );
//     if (!isMatch) {
//       return res.status(401).json({ message: "Denied access" });
//     }
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Denied access" });
//   }
// });
