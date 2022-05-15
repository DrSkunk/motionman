import axios from "axios";
import fs from "fs/promises";
import { fetchImages } from "./publicPhotos";
import path from "path";
const { createFFmpeg, fetchFile } = require("@ffmpeg/ffmpeg");

const tempDir = "/tmp/stitcher/";

export default async function photos(req, res) {
  const { albumUrl } = req.query;
  let { fps } = req.query;
  if (!albumUrl) {
    return res
      .status(400)
      .send({ error: "albumUrl query parameter is required." });
  }

  try {
    const parsed = Number.parseInt(fps, 10);
    if (isNaN(parsed)) {
      throw new Error();
    }
  } catch (error) {
    console.warn("📷 - Invalid fps value. Using default value of 8.");
    fps = 8;
  }

  try {
    fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.log(error);
  }
  const photos = await fetchImages(albumUrl);
  await download(photos, tempDir);

  const resultName = path.join(tempDir, "output.mp4");

  await stitch(resultName, tempDir, fps);
  const video = await fs.readFile(resultName);

  res.setHeader("Content-Type", "video/mp4 ");
  res.status(200).send(Buffer.from(video));
  // return res.status(200).send("ok");
}

async function stitch(resultName, photosDir, fps) {
  const photos = (await fs.readdir(photosDir)).filter((f) =>
    f.endsWith(".jpg")
  );
  console.log(`📷 - Found ${photos.length} images.`);

  const ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();
  // ffmpeg.FS("writeFile", "test.avi", await fetchFile("./test.avi"));
  for (const photo of photos) {
    ffmpeg.FS("writeFile", photo, await fetchFile(path.join(photosDir, photo)));
  }

  await ffmpeg.run(
    "-r",
    fps.toString(),
    "-i",
    "%04d.jpg",
    "-r",
    "30",
    "out.mp4"
  );
  await fs.writeFile(resultName, ffmpeg.FS("readFile", "out.mp4"));

  console.log(
    `📷 - Stitched ${photos.length} photos to ${resultName} with ${fps} fps.`
  );
}

async function download(photos, photosDir) {
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const { data } = await axios.get(photo, { responseType: "arraybuffer" });
    const fileName = `${(i + 1).toString().padStart(4, "0")}.jpg`;
    await fs.writeFile(path.join(photosDir + fileName), data);
    console.log(`📷 - Saved image ${i + 1}`);
  }
}
