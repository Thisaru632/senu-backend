const express = require('express');
const router = express.Router();
const Link = require('../models/Link');

// @route   GET /api/links
// @desc    Get all links
// @access  Public (or adjust based on your auth middleware if required)
router.get('/', async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 });
    res.json(links);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/links
// @desc    Create a new link
// @access  Public/Admin
router.post('/', async (req, res) => {
  const { title, url, description } = req.body;

  try {
    const newLink = new Link({
      title,
      url,
      description
    });

    const link = await newLink.save();
    res.json(link);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/links/:id
// @desc    Update a link
// @access  Public/Admin
router.put('/:id', async (req, res) => {
  const { title, url, description } = req.body;

  try {
    let link = await Link.findById(req.params.id);
    if (!link) {
      return res.status(404).json({ msg: 'Link not found' });
    }

    link.title = title || link.title;
    link.url = url || link.url;
    if (description !== undefined) {
      link.description = description;
    }

    link = await link.save();
    res.json(link);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/links/:id
// @desc    Delete a link
// @access  Public/Admin
router.delete('/:id', async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);
    if (!link) {
      return res.status(404).json({ msg: 'Link not found' });
    }

    await link.deleteOne();
    res.json({ msg: 'Link removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Link not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
