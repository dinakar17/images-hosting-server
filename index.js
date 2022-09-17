// https://medium.com/swlh/how-to-upload-image-using-multer-in-node-js-f3aeffb90657#:~:text=Import%20express%2Cmulter%20and%20initialize%20port%20variable%20to%203000.&text=This%20will%20set%20image%20upload,general%20example%20and%20understand%20it.

var express = require("express");
var fs = require("fs");
var multer = require("multer");
var cors = require("cors");
var port = 5001;

var app = express();

const corsOptions ={
  origin:'http://localhost:3000', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
app.use(cors(corsOptions));
// give cross-origin permission to localhost:3000

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
var upload = multer({ storage: storage });

/*
app.use('/a',express.static('/b'));
Above line would serve all files/folders inside of the 'b' directory
And make them accessible through http://localhost:3000/a.
*/
app.use(express.static(__dirname + "/public"));
app.use("/uploads", express.static("uploads"));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

// https://stackoverflow.com/questions/31530200/node-multer-unexpected-field
app.post(
  "/imagev2api/profile-upload-single",
  upload.single("profile-file"),
  function (req, res, next) {
    //   request format: {
    //     "file-0": File,
    //     "file-1": File
    // }
    console.log(req.file);

    // req.file is the `profile-file` file
    // req.body will hold the text fields, if there were any
    console.log(JSON.stringify(req.file));

    // var response = '<a href="/">Home</a><br>';
    // response += "Files uploaded successfully.<br>";
    // response += `<img src="${req.file.path}" /><br>`;
    /*
    // The response must have a "result" array.
                "result": [
                    {
                        "url": src,
                        "name": files[0].name,
                        "size": files[0].size
                    },
    */
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

app.delete("/delete-file", function (req, res) {
  // http://localhost:3000/delete-file?filePath=uploads/1.jpg
  console.log("Delete request received");
  var filePath = req.query.filePath;
  // Delete file from uploads folder. For example if filePath is 'uploads/abc.jpg' then file 'abc.jpg' will be deleted from uploads folder.
  fs.unlink(filePath, function (err) {
    if (err) {
      console.log(err);
      return res.status(500).send("Error deleting file.");
    }
    return res.send("File deleted successfully.");
  });
});

app.listen(port, () => console.log(`Server running on port ${port}!`));
