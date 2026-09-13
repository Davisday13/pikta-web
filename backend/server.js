require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupDb } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Hello World'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
