const express = require("express");
const path = require("path");
const pool = require("../config");
const Joi = require("joi");
const fs = require("fs");
const multer = require("multer");
const { isLoggedIn } = require("../middlewares");
const { log } = require("console");

router = express.Router();

const blogOwner = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  const [[blog]] = await pool.query("SELECT * FROM blogs WHERE id=?", [req.params.id]);
  if (blog.create_by_id !== req.user.id) {
    return res.status(403).send("You do not have permission to perform this action");
  }

  next();
};

// SET STORAGE
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "./static/uploads");
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage, limits: {fileSize: 1024 * 1024} });

router.put("/blogs/addlike/:id", isLoggedIn, async function (req, res, next) {
  const conn = await pool.getConnection();
  // Begin transaction
  await conn.beginTransaction();

  try {
    let [rows, fields] = await conn.query("SELECT `like` FROM `blogs` WHERE `id` = ?", [req.params.id]);
    let like = rows[0].like + 1;

    await conn.query("UPDATE `blogs` SET `like` = ? WHERE `id` = ?", [like, req.params.id]);

    await conn.commit();
    res.json({ like: like });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json(err);
  } finally {
    console.log("finally");
    conn.release();
  }
});

const postSchema = Joi.object({
  title: Joi.string().required().min(10).max(25).regex(/^[a-zA-Z]+$/),
  content: Joi.string().required().min(50),
  pinned: Joi.number().integer(),
  status: Joi.string().required().valid('status_private', 'status_public'),
  reference: Joi.string().uri(),
  start_date: Joi.alternatives().conditional('end_date', {
    then: Joi.date()
  }),
  end_date: Joi.date().min(Joi.ref('start_date')),
});

router.post("/blogs", isLoggedIn, upload.array("myImage", 5), async function (req, res, next) {
  try {
    await postSchema.validateAsync(req.body, { abortEarly: false });
  } catch (err) {
    return res.status(400).send(err);
  }

  const file = req.files;
  let pathArray = [];

  if (!file) {
    return res.status(400).json({ message: "Please upload a file" });
  }

  const title = req.body.title;
  const content = req.body.content;
  const status = req.body.status;
  const pinned = req.body.pinned;
  const reference = req.body.reference;
  const start_date = req.body.start_date;
  const end_date = req.body.end_date
  // Begin transaction
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  // req.user.id
  try {
    let results = await conn.query(
      "INSERT INTO blogs(title, content, status, pinned, `like`, create_date, create_by_id, `reference`, start_date, end_date) " +
        "VALUES(?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, ?);",
      [title, content, status, pinned, req.user.id, reference, start_date, end_date]
    );
    const blogId = results[0].insertId;

    req.files.forEach((file, index) => {
      let path = [blogId, file.path.substring(6), index == 0 ? 1 : 0];
      pathArray.push(path);
    });

    await conn.query("INSERT INTO images(blog_id, file_path, main) VALUES ?;", [pathArray]);

    await conn.commit();
    res.status(200).send("success!");
  } catch (err) {
    console.log(err);
    await conn.rollback();
    return res.status(400).json(err);
  } finally {
    conn.release();
  }
});

router.get("/blogs/:id", function (req, res, next) {
  // Query data from 3 tables
  const promise1 = pool.query("SELECT * FROM blogs WHERE id=?", [req.params.id]);
  const promise2 = pool.query("SELECT * FROM comments WHERE blog_id=?", [req.params.id]);
  const promise3 = pool.query("SELECT * FROM images WHERE blog_id=?", [req.params.id]);

  // Use Promise.all() to make sure that all queries are successful
  Promise.all([promise1, promise2, promise3])
    .then((results) => {
      const [blogs, blogFields] = results[0];
      const [comments, commentFields] = results[1];
      const [images, imageFields] = results[2];
      res.json({
        blog: blogs[0],
        images: images,
        comments: comments,
        error: null,
      });
    })
    .catch((err) => {
      return res.status(500).json(err);
    });
});

router.put("/blogs/:id", isLoggedIn, blogOwner, upload.array("myImage", 5), async function (req, res, next) {
  // Your code here
  const file = req.files;
  let pathArray = [];

  if (!file) {
    const error = new Error("Please upload a file");
    error.httpStatusCode = 400;
    next(error);
  }

  const title = req.body.title;
  const content = req.body.content;
  const status = req.body.status;
  const pinned = req.body.pinned;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    console.log(content);
    let results = await conn.query("UPDATE blogs SET title=?, content=?, status=?, pinned=? WHERE id=?", [
      title,
      content,
      status,
      pinned,
      req.params.id,
    ]);

    if (file.length > 0) {
      file.forEach((file, index) => {
        let path = [req.params.id, file.path.substring(6), 0];
        pathArray.push(path);
      });

      await conn.query("INSERT INTO images(blog_id, file_path, main) VALUES ?;", [pathArray]);
    }

    await conn.commit();
    res.send("success!");
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    console.log("finally");
    conn.release();
  }
  return;
});

router.delete("/blogs/:id", isLoggedIn, blogOwner, async function (req, res, next) {
  // Your code here
  const conn = await pool.getConnection();
  // Begin transaction
  await conn.beginTransaction();

  try {
    // Check that there is no comments
    const [rows1, fields1] = await conn.query("SELECT COUNT(*) FROM `comments` WHERE `blog_id` = ?", [req.params.id]);
    console.log(rows1);

    if (rows1[0]["COUNT(*)"] > 0) {
      return res.status(400).json({ message: "Cannot delete blogs with comments" });
    }

    //Delete files from the upload folder
    const [images, imageFields] = await conn.query("SELECT `file_path` FROM `images` WHERE `blog_id` = ?", [
      req.params.id,
    ]);
    const appDir = path.dirname(require.main.filename); // Get app root directory
    console.log(appDir);
    images.forEach((e) => {
      const p = path.join(appDir, "static", e.file_path);
      fs.unlinkSync(p);
    });

    // Delete images
    await conn.query("DELETE FROM `images` WHERE `blog_id` = ?", [req.params.id]);
    // Delete the selected blog
    const [rows2, fields2] = await conn.query("DELETE FROM `blogs` WHERE `id` = ?", [req.params.id]);

    if (rows2.affectedRows === 1) {
      await conn.commit();
      res.status(204).send();
    } else {
      throw "Cannot delete the selected blog";
    }
  } catch (err) {
    console.log(err);
    await conn.rollback();
    return res.status(500).json(err);
  } finally {
    conn.release();
  }
});

exports.router = router;
