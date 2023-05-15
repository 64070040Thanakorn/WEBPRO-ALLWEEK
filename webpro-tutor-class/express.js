const express = require("express");
const app = express();

const pool = require("./config/database");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/todo/", async (req, res) => {
  try {
    const title = req.body.title;
    const description = req.body.description;
    const due_date = req.body.due_date;
    if (title === "") {
      throw new Error("ต้องกรอก title");
    }
    if (description === "") {
      throw new Error("ต้องกรอก description");
    }
    const [rows2, fields2] = await pool.query("SELECT MAX(`order`) AS maxOrder FROM todo");
    const order = rows2[0].maxOrder;
    const [rows1, fields1] = await pool.query("INSERT INTO todo VALUES (?, ?, ?, ?, ?)", [req.params.id, title, description, due_date ? due_date : new Date(), order + 1]);

    const [rows3, fields3] = await pool.query("SELECT *, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date  FROM todo WHERE id = ?", [rows1.insertId]);
    console.log(rows3);
    res.status(201).json({
      message: `สร้าง ToDo '${title}' สำเร็จ`,
      todo: {
        id: rows3[0].id,
        title: rows3[0].title,
        description: rows3[0].description,
        due_date: rows3[0].due_date,
        order: rows3[0].order,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/todo/:id/", async (req, res) => {
  try {
    const [rows2] = await pool.query("SELECT title FROM todo WHERE id = ?", [req.params.id]);
    const [rows] = await pool.query("DELETE FROM todo WHERE id = ?", [req.params.id]);
    console.log(rows2);
    res.status(200).json({ message: `ลบ ToDo '${rows2[0].title}' สำเร็จ` });
  } catch (error) {
    res.status(404).json({ message: "ไม่พบ ToDo ที่ต้องการลบ" });
  }
});

app.get("/todo/", async (req, res) => {
  try {
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    if (!start_date || !end_date) {
      const [rows] = await pool.query("SELECT *, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date FROM todo");
      res.status(200).send(rows);
    } else {
      const [rows] = await pool.query("SELECT *, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date FROM todo WHERE due_date BETWEEN ? AND ?", [start_date, end_date]);
      res.status(200).send(rows);
    }
  }
  catch (error) {
    res.status(200);
  }
});

// joiiiii
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

/**
 *  เริ่มทำข้อสอบได้ที่ใต้ข้อความนี้เลยครับ
 * !!! ไม่ต้องใส่ app.listen() ในไฟล์นี้นะครับ มันจะไป listen ที่ไฟล์ server.js เองครับ !!!
 * !!! ห้ามลบ module.exports = app; ออกนะครับ  ไม่งั้นระบบตรวจไม่ได้ครับ !!!
 */

module.exports = app;
