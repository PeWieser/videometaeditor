# Video Meta Editor

Video Meta Editor is a desktop application built with Electron and React that allows you to view and edit metadata of video files seamlessly. It provides a user-friendly interface to manage your video library and ensures high-performance metadata operations by utilizing FFmpeg under the hood.

## 🌟 Features

- **Metadata Editing**: Easily view and edit video metadata (title, year, genre, synopsis, etc.).
- **TMDB Integration**: Automatically fetch movie and TV show metadata from The Movie Database (TMDB).
- **Offline Mode**: Fully functional offline editing capabilities without requiring an internet connection once binaries are set up.
- **Auto-Download FFmpeg**: Automatically downloads necessary `ffmpeg` and `ffprobe` binaries on the first startup if they are not present, ensuring a smooth out-of-the-box experience.
- **Modern UI**: A sleek and responsive user interface built with React and Mantine components.

## 🏗️ Architecture

The application is built using a modern Electron-React stack:
- **Main Process (Electron)**: Handles system-level operations, file system access, FFmpeg execution via `fluent-ffmpeg`, and TMDB API requests. It also manages the automatic downloading of required binaries.
- **Renderer Process (React)**: Provides the user interface, utilizing Mantine UI and Tabler Icons for a polished look. It communicates with the main process securely via IPC (Inter-Process Communication).

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd videometaeditor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application in development mode:**
   ```bash
   npm start
   ```
   *Note: This runs both the React development server and the Electron application concurrently.*

## 🛠️ Usage

1. Launch the application. If this is your first time, the application will automatically download `ffmpeg.exe` and `ffprobe.exe` into the `bin/` directory.
2. Import a video file into the application.
3. View the existing metadata and make your desired edits manually or search TMDB to auto-fill details.
4. Save the changes. The application uses FFmpeg to efficiently write the new metadata to the video file.

## 💻 Technologies

- **[Electron](https://electronjs.org/)**: Cross-platform desktop application framework.
- **[React](https://reactjs.org/)**: UI library for building the renderer.
- **[Mantine](https://mantine.dev/)**: Fully featured React components library.
- **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)**: Node.js wrapper for FFmpeg.
- **[axios](https://axios-http.com/)**: Promise-based HTTP client for TMDB API integration.

## 🌐 Offline Mode

Video Meta Editor is designed with offline use in mind. As long as the `ffmpeg` binaries are downloaded (either automatically on first run or placed manually in the `bin/` folder), you can edit local video metadata without any internet connection. The TMDB fetching features will simply be disabled when offline.

## 📄 License

This project is licensed under the MIT License.
