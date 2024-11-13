const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = 3000;

// Set up multer for multiple file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/x-wav') {
      cb(null, true);
    } else {
      cb(new Error('Only .mp3 and .wav files are allowed!'));
    }
  }
}).array('audioFiles'); // Accept multiple files

// Key to semitone mapping
const keyToSemitone = {
  'c major': 0, 'a minor': 0, 'c# major': 1, 'a# minor': 1, 'd major': 2, 'b minor': 2,
  'd# major': 3, 'c minor': 3, 'e major': 4, 'c# minor': 4, 'f major': 5, 'd minor': 5,
  'f# major': 6, 'd# minor': 6, 'g major': 7, 'e minor': 7, 'g# major': 8, 'f minor': 8,
  'a major': 9, 'f# minor': 9, 'a# major': 10, 'g minor': 10, 'b major': 11, 'g# minor': 11,
  'cb major': 11, 'ab minor': 8, 'db major': 1, 'bb minor': 10, 'eb major': 3, 'eb minor': 3,
  'gb major': 6, 'db minor': 1, 'ab major': 8, 'gb minor': 6, 'bb major': 10, 'bb minor': 10,
};

// Function to extract key and BPM from filename
function extractKeyAndBpm(filename) {
  const cleanedName = filename.replace(/[\s_]+/g, '').toLowerCase();
  const keyMatch = cleanedName.match(/([a-g][#b]?)(maj|minor|major|min)/);
  const bpmMatch = filename.match(/(\d{2,3})/);

  const key = keyMatch ? `${keyMatch[1]} ${keyMatch[2].startsWith('maj') ? 'major' : 'minor'}` : null;
  const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;

  return { key, bpm };
}

// Function to calculate semitone shift
function calculateSemitoneShift(originalKey, targetKey) {
  const originalSemitone = keyToSemitone[originalKey];
  const targetSemitone = keyToSemitone[targetKey];
  
  let semitoneShift = targetSemitone - originalSemitone;
  if (semitoneShift > 6) {
    semitoneShift -= 12;
  } else if (semitoneShift < -6) {
    semitoneShift += 12;
  }

  return semitoneShift;
}

// Function to calculate atempo filters for BPM adjustment
function getAtempoFilters(speedFactor) {
  let filters = [];
  while (speedFactor > 2.0 || speedFactor < 0.5) {
    if (speedFactor > 2.0) {
      filters.push("atempo=2.0");
      speedFactor /= 2.0;
    } else if (speedFactor < 0.5) {
      filters.push("atempo=0.5");
      speedFactor /= 0.5;
    }
  }
  filters.push(`atempo=${speedFactor.toFixed(2)}`);
  return filters;
}

// Serve static HTML page
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to handle file upload, key, and BPM adjustment
app.post('/process-audio', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(500).send(`Upload Error: ${err.message}`);
    }

    const audioFiles = req.files;

    // Extract key and BPM for each file
    const filesWithInfo = audioFiles.map(file => {
      const { key, bpm } = extractKeyAndBpm(file.originalname);
      return { ...file, key, bpm };
    });

    // Select a random base file with a key
    const baseFile = filesWithInfo.find(file => file.key) || null;
    if (!baseFile || !baseFile.bpm) {
      return res.status(400).send("Error: No suitable base file with key and BPM found.");
    }

    const targetKey = baseFile.key;
    const targetBpm = baseFile.bpm;
    const processedFiles = [];

    // Adjust all files to match the target key and BPM
    let processingCount = 0;
    filesWithInfo.forEach(file => {
      const outputFilePath = `uploads/processed_${file.originalname}`;
      let ffmpegCommand = ffmpeg(file.path);

      // Adjust key if the file has a key
      if (file.key && file.key !== targetKey) {
        const semitones = calculateSemitoneShift(file.key, targetKey);
        const pitchFactor = Math.pow(2, semitones / 12);
        ffmpegCommand = ffmpegCommand.audioFilters(`rubberband=pitch=${pitchFactor}`);
      }

      // Adjust BPM if the file has a BPM
      if (file.bpm && file.bpm !== targetBpm) {
        const speedFactor = targetBpm / file.bpm;
        const atempoFilters = getAtempoFilters(speedFactor);
        ffmpegCommand = ffmpegCommand.audioFilters(...atempoFilters);
      }

      // Process the file
      ffmpegCommand.output(outputFilePath)
        .on('end', () => {
          processedFiles.push(outputFilePath);
          processingCount++;
          if (processingCount === filesWithInfo.length) {
            // Combine all adjusted files into one file
            const combinedOutputPath = 'uploads/combined_output.mp3';
            let combineCommand = ffmpeg();

            processedFiles.forEach(file => {
              combineCommand = combineCommand.input(file);
            });

            combineCommand
              .complexFilter('amix=inputs=' + processedFiles.length + ':duration=longest')
              .output(combinedOutputPath)
              .on('end', () => {
                res.download(combinedOutputPath, (err) => {
                  processedFiles.forEach(fs.unlinkSync);  // Clean up individual files
                  fs.unlinkSync(combinedOutputPath);     // Clean up the combined output
                  audioFiles.forEach(file => fs.unlinkSync(file.path)); // Clean up uploaded files
                });
              })
              .on('error', err => res.status(500).send(`Error combining audio: ${err.message}`))
              .run();
          }
        })
        .on('error', err => res.status(500).send(`Error processing audio file: ${err.message}`))
        .run();
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});