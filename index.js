import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

db.connect().then(() => {
  console.log('Connected to the database');
}).catch((err) => {
  console.error('Database connection error:', err.stack);
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// let currentUserId = 12;
let users = [];
var error, countries, currentUserId;

async function getCurrentUserId(){
  const result = await db.query("SELECT id FROM users LIMIT 1");
  return result.rows[0].id;
}

async function checkVisisted(currentUserId) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id= $1",
    [currentUserId]
  );
  countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

app.get("/", async (req, res) => {
  try {
    db.query("SELECT * FROM users", (err, res) => {
      users = res.rows;
    });
  } catch (err) {
    console.log(err.message);
  }
  if(!currentUserId){           //init case
    currentUserId=await getCurrentUserId();
  }
  countries = await checkVisisted(currentUserId);
  let currentColor= await db.query("SELECT color FROM users WHERE id=$1", [currentUserId]); //gets map color
  res.render("index.ejs", {
    error: error,
    countries: countries,
    total: countries.length,
    users: users,
    color: currentColor.rows[0].color, //passes relevent color!
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT country_code FROM world_countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );
    const data = result.rows[0].country_code;

    if (countries.some((country_code) => country_code == data)) {
      error = "Country already logged. Try again!";
      res.redirect("/");
    } else {
      try {
        countries.push(data);
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [data, currentUserId]
        );
        error = "";
        res.redirect("/");
      } catch (err) {
        error = "Choose a user profile first!";
        console.log(err);
        res.redirect("/");
      }
    }
  } catch (err) {
    error = "Country doesn't exist. Try again!";
    console.log(err);
    res.redirect("/");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add) {
    res.render("new.ejs");
  } else {
    // console.log(req.body);  //we get the id
    currentUserId = req.body.user;
    error="";
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  console.log(req.body);
  try {
    db.query("INSERT INTO users (name, color) VALUES ($1, $2)", [
      req.body.name,
      req.body.color,
    ]);
  } catch (err) {
    console.log(err.message);
  }
  currentUserId = req.body.user;
  error= "Choose a profile first!";
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
