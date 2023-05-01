const express = require("express");
// const { connect } = require("http2");
const pool = require("../config");
const upload = require("../multer");

const router = express.Router();

// Get comment
router.get("/:blogId/comments", function (req, res, next) {


});

// Create new comment
router.post("/blogs/:blogId/", upload.single("myImage"), async function (req, res, next) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let comment = await conn.query("INSERT INTO comments (blog_id, comment, comments.like, comment_by_id) VALUES (?, ?, ?, ?);", [req.params.blogId, req.body.comment, 0, null]);
    const commentId = comment[0].insertId;

    if (req.file) {
      console.log(req.file);
      await conn.query("INSERT INTO images(blog_id, file_path, comment_id) VALUES(?, ?, ?);", [req.params.blogId, req.file.path.substr(6), commentId]);

    } else {
      console.log("No File selected");
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    return next(err);
  } finally {
    console.log("finally");
    conn.release();
  }
  res.redirect(`/blogs/${req.params.blogId}`);
});

// Update comment
router.put("/comments/:commentId", async function (req, res, next) {
  const { comment, like, comment_date, comment_by_id, blog_id } = req.body;

  const [rows, fields] = await pool.query(`UPDATE comments SET comment = ?, comments.like = ?, comment_date = ?, comment_by_id = ?, blog_id = ? WHERE id = ${req.params.commentId}`, [comment, like, comment_date, comment_by_id, blog_id]);

  const [rows1, fields1] = await pool.query(`SELECT comment, comments.like, comment_date, comment_by_id, blog_id FROM comments WHERE id = ${req.params.commentId}`);

  return res.json({
    message: `Comment ID ${req.params.commentId} is updated.`,
    comment: {
      comment: rows1[0].comment,
      like: rows1[0].like,
      comment_date: rows1[0].comment_date,
      comment_by_id: rows1[0].comment_by_id,
      blog_id: rows1[0].blog_id,
    }, //ดึงข้อมูล comment ที่เพิ่งถูก update ออกมา และ return ใน response กลับไปด้วย
  });
});

// Delete comment
router.delete("/comments/:commentId", async function (req, res, next) {
  const [rows, fields] = await pool.query(`DELETE FROM comments WHERE id = ?`, [req.params.commentId]);
  return res.json({
    message: `Comment ID ${req.params.commentId} is deleted.`,
  });
});

// Add like to comment
router.put("/comments/addlike/:commentId", async function (req, res, next) {
  const [rows1, fields1] = await pool.query(`UPDATE comments SET comments.like = comments.like + 1 WHERE id = ${req.params.commentId}`);

  const [rows2, fields2] = await pool.query(`SELECT id, blog_id, comments.like FROM comments WHERE id = ${req.params.commentId}`);

  return res.json({
    blogId: rows2[0].blog_id,
    commentId: rows2[0].id,
    likeNum: rows2[0].like, //5 คือจำนวน like ของ comment ที่มี id = 20 หลังจาก +1 like แล้ว
  });
});

exports.router = router;
