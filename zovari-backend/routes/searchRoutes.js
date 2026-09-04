const express = require("express");
const router = express.Router();
const { search } = require("../controllers/searchController");
const { optionalAuth } = require("../middleware/auth");

router.get("/", optionalAuth, search);

module.exports = router;
