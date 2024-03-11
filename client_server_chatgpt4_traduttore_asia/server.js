// Import the required modules
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const Rettiwt = require("rettiwt-api").Rettiwt;

const archivio = require("./europe.json");

// Prompt generation from twitter
const twitterKey = "YOUR TWITTER API KEY";
const rettiwt = new Rettiwt({ apiKey: twitterKey });
let lastTweet = "";
let account = "";

// Image upload
const bucketName = "news-to-image";
const supabaseUrl = "YOUR SUPABASE URL";
const supabaseKey = "YOUR SUPABASE API KEY";
const supabase = createClient(supabaseUrl, supabaseKey);
let imageUrl = "";

//Prompt translation
const translatorKey = "YOUR MICROSOFT TRANSLATOR KEY";
const endpoint = "https://api.cognitive.microsofttranslator.com/";

async function promptTranslation(text) {
  const url = `${endpoint}/translate?api-version=3.0&to=en`;
  const options = {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": translatorKey,
      "Ocp-Apim-Subscription-Region": "northeurope", // Specifica la regione del tuo servizio, es. "westeurope"
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  };

  try {
    const response = await fetch(url, options);
    const jsonResponse = await response.json();
    const instruction = jsonResponse[0].translations[0].text;
    promptGeneration(instruction);
    console.log("Lingua rilevata:", jsonResponse[0].detectedLanguage.language);
    console.log("Testo tradotto:", jsonResponse[0].translations[0].text);
  } catch (error) {
    console.error("Errore nella traduzione:", error);
  }
}

// Image generation
const openai = new OpenAI({
  organization: "YOUR OPENAI ORGANIZATION",
  apiKey: "YOUR OPENAI API KEY",
});

async function promptGeneration(instruction) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Rewrite the following text, making it a perfect prompt for DALL-E 3 to create a vertical oriented image, adding all the details so that the scene described by the text is as well-described as possible. Reach a maximum of 2000 characters without ever creating a new paragraph. Adapt the final prompt so as not to violate your policy. Do not add quotes within the text. Specify that the image should be a photo, avoiding collages and illustrations: ${instruction}`,
      },
    ],
    model: "gpt-4-turbo-preview",
    temperature: 0,
    top_p: 0,
  });
  console.log(completion.choices[0].message.content);
  const description = instruction;
  instruction = completion.choices[0].message.content;
  image_generate(instruction, description);
}

const image_generate = async (instruction, description, retry = 0) => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: instruction,
      n: 1,
      size: "1024x1792",
      quality: "hd",
      style: "natural",
    });
    console.log("response", response.data[0].url);
    imageUrl = response.data[0].url;
    const id_image = new Date().getTime();
    const pathInBucket = id_image + ".webp";
    uploadImageToSupabase(id_image, imageUrl, bucketName, pathInBucket, description);
  } catch (error) {
    console.log("BUUU ERRORE");
    if (retry > 1) {
      getTweet();
    } else {
      retry++;
      console.log("retry: " + retry);
      image_generate(instruction, description, retry);
    }
  }
};

// Function to upload an image to Supabase Storage
async function uploadImageToSupabase(id_image, imageUrl, bucketName, pathInBucket, description) {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Image fetch failed");

    // Get the image buffer
    const buffer = await response.buffer();

    // Upload the image to Supabase Storage
    const { data, error } = await supabase.storage.from(bucketName).upload(pathInBucket, buffer, {
      contentType: response.headers.get("content-type"),
      upsert: true, // Set to true to overwrite an existing file with the same path
    });

    if (error) throw error;

    console.log("Upload successful");
    insertImageRecord(id_image, `https://cbkfspvaaiewasutjomn.supabase.co/storage/v1/object/public/news-to-image/${pathInBucket}`, description, account.state, account.timezone, formatDateAndTimeWithOffset(account.timezone - 1));

    return data;
  } catch (error) {
    setTimeout(() => {
      uploadImageToSupabase(id_image, imageUrl, bucketName, pathInBucket, description);
    }, 30000);
    throw error;
  }
}

// create table row----------------------------------------------------
async function insertImageRecord(id_image, imagePath, description, state, timeZone, date_time) {
  const { data, error } = await supabase.from("asia").insert([{ id: id_image, href: imagePath, description: description, state: state, time_zone: timeZone, date_time: date_time }]);

  if (error) throw error;
  start();
  // return data;
}

//calculate time and date
function formatDateAndTimeWithOffset(offsetString) {
  // Parse the offset string to get the number of hours
  const offsetHours = parseInt(offsetString, 10);

  // Get the current date and time
  let currentDate = new Date();

  // Calculate the time offset in milliseconds (offsetHours * number of milliseconds in an hour)
  const offsetMilliseconds = offsetHours * 60 * 60 * 1000;

  // Adjust the date by the offset
  currentDate = new Date(currentDate.getTime() + offsetMilliseconds);

  // Format the date and time components
  const day = currentDate.getDate().toString().padStart(2, "0");
  const month = (currentDate.getMonth() + 1).toString().padStart(2, "0"); // JavaScript months are 0-indexed
  const year = currentDate.getFullYear();
  const hours = currentDate.getHours().toString().padStart(2, "0");
  const minutes = currentDate.getMinutes().toString().padStart(2, "0");
  const seconds = currentDate.getSeconds().toString().padStart(2, "0");

  // Combine the components into the final string
  const formattedDateTime = `${day}.${month}.${year} - ${hours}:${minutes}:${seconds}`;

  return formattedDateTime;
}

//get tweet
function getTweet() {
  rettiwt.tweet
    .list("1764744534695485462")
    .then((res) => {
      if (lastTweet != res.list[0].id) {
        account = res.list[0].tweetBy.userName;
        archivio.accounts.forEach((acc) => {
          if (account == acc.id) {
            account = acc;
          }
        });
        const instruction = removeUrl(res.list[0].fullText);
        console.log(instruction);
        if (instruction.length < 275) {
          promptTranslation(instruction);
          lastTweet = res.list[0].id;
        } else {
          getTweet();
        }
      } else {
        getTweet();
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

function removeUrl(str) {
  const regex = /http\S*\s?|[#@]/g;
  return str.replace(regex, "");
}

//getTweet();

//start the server
async function start() {
  console.log("--------inizio il processo--------");
  const { data, error } = await supabase
    .from("asia") // Replace with your table name
    .select("*") // Assuming your column storing the image URL is named 'image_url'
    .order("id", { ascending: false }) // Replace 'created_at' with your timestamp or ID column
    .limit(1)
    .single(); // Ensures that the response structure is simplified for single row

  if (error) {
    console.error("Error fetching the last uploaded image URL:", error);
    return null;
  }

  if (data.used) {
    getTweet();
  } else {
    setTimeout(() => {
      start();
    }, 1000);
  }
}

start();
