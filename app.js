// filepath: /C:/Users/unger.amber/Documents/GitHub/pogipediaAU24-25/app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'db', 'pog.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

let darkMode = false;
if (process.env.DARK_MODE === 'true') {
  darkMode = true;
  console.log('Dark mode is enabled.');

}
const lightRanks = {
  'Uncommon': '#EBF8DC',
  'Trash': '#fcdcdc',
  'Common': '#ffedc1',
  'Rare': '#DCF2F8',
  'Mythic': '#E7D5F3',
  'Default': '#FFFFFF'
};

const darkRanks = {
  'Uncommon': '#395013',
  'Trash': '#660e0e',
  'Common': '#ad6309',
  'Rare': '#1d4a6e',
  'Mythic': '#332974',
  'Default': '#414141'
};

function getBackgroundColor(rank) {
  console.log('Rank:', rank); // Debugging: Log the rank value
  const color = darkMode ? darkRanks[rank] || darkRanks['Default'] : lightRanks[rank] || lightRanks['Default'];
  console.log('Background Color:', color); // Debugging: Log the background color
  return color;
}

// Function to initialize the database
function initializeDatabase() {
  db.serialize(() => {
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS pogs (
        uid INTEGER PRIMARY KEY,
        serial TEXT,
        name TEXT NOT NULL,
        color TEXT,
        tags TEXT NOT NULL,
        lore TEXT,
        rank TEXT,
        creator TEXT,
        description TEXT,
        imageUrl TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS variations (
        uid INTEGER PRIMARY KEY,
        pog_id INTEGER NOT NULL,
        variation TEXT NOT NULL,
        FOREIGN KEY (pog_id) REFERENCES pogs (uid)
      )
    `);
  });
}

// Route to render the index page
app.get('/', (req, res) => {
  // Fetch all pogs
  db.all('SELECT * FROM pogs', (err, pogs) => {
    if (err) {
      return res.status(500).send(err.message);
    }

    res.render('index', {
      pogs: pogs,
      getBackgroundColor: getBackgroundColor, // Pass the function to the template
      ranks: darkMode ? darkRanks : lightRanks // Pass the ranks object to the template
    });
  });
});

// Route to handle theme preference
app.post('/setTheme', (req, res) => {
  darkMode = req.body.darkMode;
  res.sendStatus(200);
});

// Route to handle search request
app.post('/searchPogs', (req, res) => {
  const { id, name, serial, tags } = req.body;
  let query = 'SELECT * FROM pogs WHERE 1=1';
  let params = [];

  if (id) {
    query += ' AND uid = ?';
    params.push(id);
  }
  if (name) {
    query += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }
  if (serial) {
    query += ' AND serial LIKE ?';
    params.push(`%${serial}%`);
  }
  if (tags) {
    query += ' AND tags LIKE ?';
    params.push(`%${tags}%`);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    rows.forEach(row => {
      row.backgroundColor = getBackgroundColor(row.rank); // Add background color based on rank
    });
    res.json(rows);
  });
});

app.get('/api/pogs', (req, res) => {
  const sql = 'SELECT uid, serial, name, color, tags, rank FROM pogs';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(rows);
  });
});

// Route to get all data about an individual pog
app.get('/api/pogs/:uid', (req, res) => {
  const uid = req.params.uid;
  db.get('SELECT * FROM pogs WHERE uid = ?', [uid], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
      } else {
          res.json(row);
      }
  });
});

// Route to get all data about an individual pog, including variations
app.get('/api/pogs/:identifier', (req, res) => {
  const identifier = req.params.identifier;
  let sql;
  let params;

  console.log(`Received identifier: ${identifier}`);

  // Check if the identifier is a number (uid) or matches a serial number pattern
  if (!isNaN(identifier)) {
    sql = 'SELECT uid, serial, name, color, tags, lore, rank, creator FROM pogs WHERE uid = ?';
    params = [identifier];
    console.log('Identifier is a number, treating as uid');
  } else if (/^\d{4}[A-Z]{1}\d{2}$/.test(identifier)) { // Adjust the regex pattern to match your serial number format
    sql = 'SELECT uid, serial, name, color, tags FROM pogs WHERE serial = ?';
    params = [identifier];
    console.log('Identifier matches serial number pattern, treating as serial');
  } else {
    return res.status(400).send('Invalid identifier format');
  }

  db.get(sql, params, (err, row) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(row);
  });
});

// Route to get all collections (tags)
app.get('/api/collections', (req, res) => {
  const sql = 'SELECT DISTINCT tags FROM pogs';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(rows);
  });
});

// Route to get all pogs in a specific collection (tag)
app.get('/api/collections/:name', (req, res) => {
  const name = req.params.name;
  const sql = 'SELECT uid, name, color FROM pogs WHERE tags = ?';
  db.all(sql, [name], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.json(rows);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});