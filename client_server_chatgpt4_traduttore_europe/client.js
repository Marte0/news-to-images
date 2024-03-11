import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js";

//start experience variabili
const intervalTime = 30000;
let isRunning = false;
const startButton = document.getElementById("bottone");

const supabaseUrl = "YOUR SUPABASE URL";
const supabaseKey = "YOUR SUPABASE KEY";
const supabase = createClient(supabaseUrl, supabaseKey);

//variabili canvas
const canvas = document.getElementById("myCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

//variabili audio
const audioKey = "YOUR ELEVENLABS KEY";

//variabili immagini
let imageWidth = canvas.width;
let imageHeight;
let image1 = new Image();
image1.crossOrigin = "Anonymous";
let image2 = new Image();
image2.crossOrigin = "Anonymous";

image1.onload = () => {
  console.log("image 1 ha loddato");
  imageHeight = canvas.width / (image1.width / image1.height);
  context.drawImage(image1, 0, 0, imageWidth, imageHeight);
  // currentLoaded = true;
};
image1.src = "https://cbkfspvaaiewasutjomn.supabase.co/storage/v1/object/public/news-to-image/1709807065040.webp";

startButton.addEventListener("click", () => {
  startButton.style.display = "none";
  setInterval(() => {
    if (!isRunning) {
      isRunning = true;
      console.log("---------------------FACCIO LE COSE---------------------");
      fetchLastUploadedImage().then((obj) => {
        if (!obj.used) {
          console.log("Last uploaded image:", obj);
          image2.src = obj.href;
          image2.onload = () => {
            emptyCartillo();
            textToSpeech(obj.description);
            pixelTransition(image1, image2).then(() => {
              image1 = image2;
              image2 = new Image();
              image2.crossOrigin = "Anonymous";
              console.log("ho sostituito le immagini");
              editCartillo(obj);
              updateState(obj);
            });
          };
        } else {
          console.log("ho gia usato questa immagine, testa di cazzo");
          isRunning = false;
        }
      });
    }
  }, intervalTime);
});
// Example usage

async function updateState(obj) {
  isRunning = false;
  console.log("uploadando stato: " + isRunning);
  const { data, error } = await supabase.from("europe").upsert({ id: obj.id, used: "TRUE" }).select();
}

async function fetchLastUploadedImage() {
  const { data, error } = await supabase
    .from("europe") // Replace with your table name
    .select("*") // Assuming your column storing the image URL is named 'image_url'
    .order("id", { ascending: false }) // Replace 'created_at' with your timestamp or ID column
    .limit(1)
    .single(); // Ensures that the response structure is simplified for single row

  if (error) {
    console.error("Error fetching the last uploaded image URL:", error);
    return null;
  }

  return data; // Return the URL of the last uploaded image
}

function editCartillo(obj) {
  document.getElementById("passedTime").innerHTML = calculatePassedTime(obj) + " minutes ago";
  document.getElementById("currentDateTime").innerHTML = obj.date_time;
  document.getElementById("timeZone").innerHTML = "(UTC" + obj.time_zone + ")";
  if (obj.state == "") {
    document.getElementById("continent").style.fontSize = "2.4375rem";
    document.getElementById("state").display = "none";
  } else {
    document.getElementById("continent").style.fontSize = "1.8125rem";
    document.getElementById("state").display = "block";
  }
  document.getElementById("continent").innerHTML = "europe";
  document.getElementById("from").innerHTML = "From";
  document.getElementById("state").innerHTML = obj.state;
  document.getElementById("prompt").innerHTML = obj.description;
}

function emptyCartillo() {
  document.getElementById("passedTime").innerHTML = "";
  document.getElementById("currentDateTime").innerHTML = "";
  document.getElementById("timeZone").innerHTML = "";
  document.getElementById("continent").innerHTML = "Loading...";
  document.getElementById("state").innerHTML = "";
  document.getElementById("prompt").innerHTML = "";
  document.getElementById("from").innerHTML = "";
}

function calculatePassedTime(obj) {
  let passedTime = Date.now() - obj.id;
  passedTime = Math.floor(passedTime / 60000);
  return passedTime;
}

function pixelate(divisionNumber, image, alpha = 1) {
  context.globalAlpha = alpha;
  let chunk = imageWidth / divisionNumber;
  context.drawImage(image, 0, 0, imageWidth, imageHeight);
  context.globalAlpha = 1;
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let y = chunk / 2; y <= canvas.height; y += chunk) {
    for (let x = chunk / 2; x <= canvas.width; x += chunk) {
      const pixelIndexPosition = (Math.floor(x) + Math.floor(y) * canvas.width) * 4;

      context.fillStyle = `rgba(${imageData[pixelIndexPosition]},${imageData[pixelIndexPosition + 1]},${imageData[pixelIndexPosition + 2]},${imageData[pixelIndexPosition + 3] * alpha})`;

      context.fillRect(x - chunk / 2, y - chunk / 2, chunk + 1, chunk + 1);
    }
  }

  return true;
}

function pixelTransition(currentImage, nextImage, maxDivisions = 100, minDivisions = 10, step = 10, intervalTime = 200) {
  return new Promise((resolve) => {
    const stepsN = (maxDivisions - minDivisions) / step;
    //const intervalTime = 200;
    const alphaStep = 1 / (stepsN * 2);
    let currentDivisions = maxDivisions;
    let alpha = alphaStep;
    let counter = 0;

    console.log("---------STEPSN = " + stepsN);

    let pixelateInterval = setInterval(() => {
      counter++;
      if (counter >= stepsN) {
        clearInterval(pixelateInterval);
        counter = 0;
        let depixelateInterval = setInterval(() => {
          counter++;
          if (counter >= stepsN) {
            clearInterval(depixelateInterval);
            setTimeout(() => {
              context.drawImage(nextImage, 0, 0, imageWidth, imageHeight);
              resolve();
            }, intervalTime);
          }
          pixelate(currentDivisions, currentImage);
          pixelate(currentDivisions, nextImage, alpha);
          alpha += alphaStep;
          currentDivisions += step;
        }, intervalTime);
      }
      pixelate(currentDivisions, currentImage);
      pixelate(currentDivisions, nextImage, alpha);
      alpha += alphaStep;
      currentDivisions -= step;
    }, intervalTime);
  });
}

//Generate audio
async function textToSpeech(instruction) {
  //const text = instruction; // Ensure this variable contains the text to convert
  const voiceId = "21m00Tcm4TlvDq8ikWAM";

  const headers = new Headers();
  headers.append("Accept", "audio/mpeg");
  headers.append("xi-api-key", audioKey);
  headers.append("Content-Type", "application/json");

  const body = JSON.stringify({
    text: instruction, // Make sure this matches the expected format
    model_id: "eleven_multilingual_v1",
    voice_settings: {
      stability: 0.99,
      similarity_boost: 0.1,
      style: 0.15,
      speed: 0.5,
    },
  });

  try {
    // Make sure the URL is correct and matches the API documentation
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text(); // Improved error feedback
      console.error(`Error: ${response.status} - ${response.statusText}`);
      console.error("Response Text:", errorText); // Displaying the detailed error message
      throw new Error(`Text to Speech API request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  } catch (error) {
    console.error("Error in ElevenLabs TTS API request:", error);
  }
}

// function emptyCartillo(){
//     let tempText=document.getElementById("passedTime").innerHTML;
//     tempText=tempText.replace(/./g, "*");
//     document.getElementById("passedTime").innerHTML = tempText;
//     tempText= document.getElementById("currentDateTime").innerHTML;
//     tempText=tempText.replace(/./g, "*");
//     document.getElementById("currentDateTime").innerHTML = tempText;
//     tempText = document.getElementById("timeZone").innerHTML;
//     tempText = tempText.replace(/./g, "*");
//     document.getElementById("timeZone").innerHTML = tempText;
//     tempText = document.getElementById("continent").innerHTML
//     tempText = tempText.replace(/./g, "*");
//     document.getElementById("continent").innerHTML = tempText;
//     tempText = document.getElementById("state").innerHTML;
//     tempText = tempText.replace(/./g, "*");
//     document.getElementById("state").innerHTML = tempText;
//     document.getElementById("prompt").innerHTML = "********************************************************";
// }
