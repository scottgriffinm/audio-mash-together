# Audio Mashup Creator

This project is an **Audio Mashup Creator** that lets users upload multiple audio files in `.mp3` or `.wav` format, analyzes each file's key and BPM, and generates a custom mashup.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Additional Notes](#additional-notes)

## Features

- **Upload multiple files**: Users can upload `.mp3` or `.wav` audio files.
- **Key and BPM extraction**: Automatically detects the musical key and BPM from file names.
- **Pitch and Tempo Adjustment**: Matches audio tracks by adjusting pitch (semitone shift) and tempo to create harmonic mashups.
- **Automatic Clean-up**: Removes temporary files after the mashup is created.

## Requirements

- **Node.js** and **npm**
- **ffmpeg** with support for `rubberband` filters (for pitch and tempo adjustments).
  - Install `rubberband` if not already included with ffmpeg:
    sudo apt-get install rubberband-ladspa

## Setup

1. **Clone the repository**:
   git clone <repository-url>
   cd <repository-folder>

2. **Install dependencies**:
   npm install

3. **Start the server**:
   node index.js
   The server will start at `http://localhost:3000`.

## Project Structure

- index.js        # Main server and application logic
- public/
  - index.html    # Frontend HTML for uploading files and creating mashups
- uploads/        # Directory for uploaded and processed audio files

## Usage

1. **Upload Files**:
   - Navigate to `http://localhost:3000` in your browser.
   - Use the file upload form to select at least three `.mp3` or `.wav` files for the mashup.


3. **Create Mashup**:
   - Click "Make Mashup Loop" to generate the mashup. The combined audio will appear in an audio player for playback.

## Troubleshooting

- **ffmpeg Errors**: If you encounter errors with `ffmpeg` not recognizing `rubberband`, ensure `ffmpeg` is installed with `rubberband` support.
- **NaN Errors in Semitone Calculation**: If semitone shifts return `NaN`, verify that the musical key is present in the `keyToSemitone` mapping in `index.js`.

## Additional Notes

- This project relies on `fluent-ffmpeg` for processing audio. Ensure `ffmpeg` is accessible in your system PATH.
- The mashup creation process involves adjusting pitch and tempo, which may affect audio quality slightly.
- Adjustments to pitch are based on a semitone shift calculation. Ensure the key mapping is up-to-date with any additional keys you wish to support.