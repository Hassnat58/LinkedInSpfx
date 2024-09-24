const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(cors());
app.get("/", (req, res) => {
  res.send("Welcome to the LinkedIn Proxy Server");
});

// Function to refresh the LinkedIn access token
async function refreshAccessToken() {
  const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.LINKEDIN_REFRESH_TOKEN,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error refreshing access token: ${response.status} - ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to refresh access token: ${errorText}`);
    }

    const data = await response.json();
    console.log("New access token received:", data.access_token);

    // Update the environment variable with the new access token
    process.env.LINKEDIN_ACCESS_TOKEN = data.access_token;

    return data.access_token;
  } catch (error) {
    console.error("Error in refreshAccessToken:", error);
    throw error;
  }
}

// Function to fetch LinkedIn posts with an active access token
async function fetchLinkedInPosts(accessToken) {
  const apiUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn%3Ali%3Aorganization%3A11092037)&projection=(elements*(id,lifecycleState,lastModified(time),specificContent(com.linkedin.ugc.ShareContent(shareCommentary,shareMediaCategory,media(*,title,description,lastModified,thumbnails,mediaType,status,originalUrl)),lastModified)))&count=20`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202305",
      },
    });

    if (response.status === 401) {
      console.log("Access token expired, refreshing token...");
      const newAccessToken = await refreshAccessToken();
      return fetchLinkedInPosts(newAccessToken); // Retry with new token
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching LinkedIn posts: ${response.status} - ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to fetch LinkedIn posts: ${errorText}`);
    }

    const data = await response.json();
    console.log("LinkedIn posts data:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Error in fetchLinkedInPosts:", error);
    throw error;
  }
}

// Route to fetch LinkedIn posts
app.get("/api/linkedin-posts", async (req, res) => {
  try {
    const data = await fetchLinkedInPosts(process.env.LINKEDIN_ACCESS_TOKEN);
    res.json(data);
  } catch (error) {
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
