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


const bpmLoopLengths = {
    120: 8.0, 121: 7.934, 119: 8.067, 122: 7.869, 118: 8.136,
    123: 7.805, 117: 8.205, 124: 7.742, 116: 8.276, 125: 7.68,
    115: 8.348, 126: 7.619, 114: 8.421, 127: 7.559, 113: 8.496,
    128: 7.5, 129: 7.442, 112: 8.571, 130: 7.385, 111: 8.649,
    131: 7.328, 110: 8.727, 132: 7.273, 133: 7.218, 109: 8.807,
    134: 7.164, 108: 8.889, 135: 7.111, 136: 7.059, 107: 8.972,
    137: 7.007, 138: 6.957, 106: 9.057, 139: 6.906, 105: 9.143,
    140: 6.857, 141: 6.809, 104: 9.231, 142: 6.761, 143: 6.713,
    103: 9.32, 144: 6.667, 145: 6.621, 102: 9.412, 146: 6.575,
    147: 6.531, 101: 9.505, 148: 6.486, 149: 6.443, 150: 6.4,
    100: 9.6, 151: 6.358, 152: 6.316, 99: 9.697, 153: 6.275,
    154: 6.234, 98: 9.796, 155: 6.194, 156: 6.154, 157: 6.115,
    97: 9.897, 158: 6.076, 159: 6.038, 96: 10.0, 160: 6.0,
    161: 5.963, 162: 5.926, 95: 10.105, 163: 5.89, 164: 5.854,
    165: 5.818, 94: 10.213, 166: 5.783, 167: 5.749, 168: 5.714,
    169: 5.68, 93: 10.323, 170: 5.647, 171: 5.614, 172: 5.581,
    92: 10.435, 173: 5.549, 174: 5.517, 175: 5.486, 176: 5.455,
    91: 10.549, 177: 5.424, 178: 5.393, 179: 5.363, 90: 10.667,
    180: 5.333, 181: 5.304, 182: 5.275, 183: 5.246, 184: 5.217,
    89: 10.787, 185: 5.189, 186: 5.161, 187: 5.134, 188: 5.106,
    88: 10.909, 189: 5.079, 190: 5.053, 191: 5.026, 192: 5.0,
    193: 4.974, 87: 11.034, 194: 4.948, 195: 4.923, 196: 4.898,
    197: 4.873, 198: 4.848, 86: 11.163, 199: 4.824, 200: 4.8,
    201: 4.776, 202: 4.752, 203: 4.729, 85: 11.294, 204: 4.706,
    205: 4.683, 206: 4.66, 207: 4.638, 208: 4.615, 209: 4.593,
    84: 11.429, 210: 4.571, 211: 4.55, 212: 4.528, 213: 4.507,
    214: 4.486, 215: 4.465, 216: 4.444, 83: 11.566, 217: 4.424,
    218: 4.404, 219: 4.384, 220: 4.364, 221: 4.344, 222: 4.324,
    223: 4.305, 82: 11.707, 224: 4.286, 225: 4.267, 226: 4.248,
    227: 4.229, 228: 4.211, 229: 4.192, 230: 4.174, 231: 4.156,
    81: 11.852, 232: 4.138, 233: 4.12, 234: 4.103, 235: 4.085,
    236: 4.068, 237: 4.051, 238: 4.034, 239: 4.017, 240: 4.0,
    80: 12.0, 241: 3.983, 242: 3.967, 243: 3.951, 244: 3.934,
    245: 3.918, 246: 3.902, 247: 3.887, 248: 3.871, 249: 3.855,
    79: 12.152, 250: 3.84
}

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

// Serve static HTML page and static files
app.use(express.static(path.join(__dirname, 'public')));
// Serve static files in "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Endpoint to handle initial file upload
app.post('/upload-audio', (req, res) => {
    upload(req, res, (err) => {
      if (err) {
        return res.status(500).send(`Upload Error: ${err.message}`);
      }
  
      // Save file info for future mashups
      const audioFiles = req.files.map(file => ({
        path: file.path,
        originalname: file.originalname
      }));
      res.json({ message: 'Files uploaded successfully', files: audioFiles });
    });
  });


  app.post('/make-mashup', express.json(), (req, res) => {
    const uploadedFiles = req.body.files;
  
    if (uploadedFiles.length < 3) {
      return res.status(400).send("Error: At least three files are required to make a mashup.");
    }
  
    // Randomly select three files
    const selectedFiles = uploadedFiles.sort(() => 0.5 - Math.random()).slice(0, 3);
  
    // Extract key and BPM for each selected file
    const filesWithInfo = selectedFiles.map(file => {
      const { key, bpm } = extractKeyAndBpm(file.originalname);
      return { ...file, key, bpm };
    });
  
    // Filter files with a key and select a random base file with a key, or any random file if none have a key
    const filesWithKeys = filesWithInfo.filter(file => file.key);
    const baseFile = filesWithKeys.length > 0 
      ? filesWithKeys[Math.floor(Math.random() * filesWithKeys.length)]
      : filesWithInfo[Math.floor(Math.random() * filesWithInfo.length)];
  
    const targetKey = baseFile.key;
    const targetBpm = baseFile.bpm || 120; // Default BPM if none is found
    const maxDuration = bpmLoopLengths[targetBpm] || 10; // Default to 10 seconds if no BPM match in `bpmLoopLengths`
    const processedFiles = [];
    let processingCount = 0;
  
    // Adjust all selected files to match the target key and BPM
    filesWithInfo.forEach(file => {
      const outputFilePath = `uploads/processed_${file.originalname}`;
      let ffmpegCommand = ffmpeg(file.path);
  
      // Adjust key if the file has a key and baseFile has a target key
      if (file.key && targetKey && file.key !== targetKey) {
        const semitones = calculateSemitoneShift(file.key, targetKey);
        const pitchFactor = Math.pow(2, semitones / 12);
        ffmpegCommand = ffmpegCommand.audioFilters(`rubberband=pitch=${pitchFactor}`);
      }
  
      // Adjust BPM if the file has a BPM and baseFile has a target BPM
      if (file.bpm && file.bpm !== targetBpm) {
        const speedFactor = targetBpm / file.bpm;
        const atempoFilters = getAtempoFilters(speedFactor);
        ffmpegCommand = ffmpegCommand.audioFilters(...atempoFilters);
      }
  
      // Process the file to match target key and BPM
      ffmpegCommand.output(outputFilePath)
        .on('end', () => {
          processedFiles.push(outputFilePath);
          processingCount++;
  
          // When all selected files are processed, combine them into one file
          if (processingCount === filesWithInfo.length) {
            const combinedOutputPath = 'uploads/combined_mashup.mp3';
            let combineCommand = ffmpeg();
  
            processedFiles.forEach(file => {
              combineCommand = combineCommand.input(file);
            });
  
            combineCommand
              .complexFilter('amix=inputs=' + processedFiles.length + ':duration=longest')
              .outputOptions([`-t ${maxDuration}`]) // Limit the output file duration to `maxDuration` seconds
              .output(combinedOutputPath)
              .on('end', () => {
                // Send the path of the combined audio to the client
                res.json({ audioPath: `/uploads/combined_mashup.mp3` });
                // Clean up individual processed files
                processedFiles.forEach(fs.unlinkSync);
              })
              .on('error', err => res.status(500).send(`Error combining audio: ${err.message}`))
              .run();
          }
        })
        .on('error', err => res.status(500).send(`Error processing audio file: ${err.message}`))
        .run();
    });
  });

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});