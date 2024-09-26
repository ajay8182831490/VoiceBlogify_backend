
Medium API Documentation
Base URL: /medium
Rate Limiting
Rate Limit: Each user is allowed a maximum of 4 requests per minute. Exceeding this limit will return a 429 Too Many Requests error with the message: "Too many requests, please try again later."
Authentication
All routes (except /url) are protected and require the user to be authenticated using the ensureAuthenticated middleware.
Endpoints
1. GET /url
Description:
Retrieves the Medium API URL.
Request:
Method: GET
Response:
Status: 200 OK
Description: Returns the Medium URL.
Example Response:
json

{
  "url": "https://medium.com/some-url"
}
2. DELETE /post/:postId
Description:
Deletes a post from Medium based on its ID.
Request:
Method: DELETE
URL Params:
postId - The ID of the post to delete.
Rate Limiting: Limited to 4 requests per minute.
Authentication: Requires the user to be authenticated (ensureAuthenticated).
Response:
Status: 200 OK - Post deleted successfully.
Status: 401 Unauthorized - User not authenticated.
Status: 429 Too Many Requests - Too many requests in a short time.
Example Response:
json

{
  "message": "Post deleted successfully"
}
3. GET /getPost/:postId
Description:
Retrieves a post from Medium by its ID.
Request:
Method: GET
URL Params:
postId - The ID of the post to retrieve.
Rate Limiting: Limited to 4 requests per minute.
Authentication: Requires the user to be authenticated (ensureAuthenticated).
Response:
Status: 200 OK - Returns the requested post.
Status: 401 Unauthorized - User not authenticated.
Status: 429 Too Many Requests - Too many requests in a short time.
Example Response:
json

{
  "id": "postId",
  "title": "Sample Post Title",
  "content": "This is the content of the post."
}
4. POST /post
Description:
Creates a new post on Medium.
Request:
Method: POST

Rate Limiting: Limited to 4 requests per minute.

Authentication: Requires the user to be authenticated (ensureAuthenticated).

Body Parameters:

title - The title of the post (required).
content - The content of the post (required).
publishStatus - Can be one of the following values: public, draft, or unlisted (required).
Body Validation:

title: Must not be empty.
content: Must not be empty.
publishStatus: Must be one of the values public, draft, or unlisted.
Example Request Body:
json

{
  "title": "My New Blog Post",
  "content": "This is the content of my blog post.",
  "publishStatus": "public"
}
Response:
Status: 200 OK - Post created successfully.
Status: 400 Bad Request - Validation error (missing or invalid data).
Status: 429 Too Many Requests - Too many requests in a short time.
Example Response:
json
Copy code
{
  "message": "Post created successfully"
}
5. POST /uploadImage
Description:
Uploads an image to Medium.
Request:
Method: POST
Rate Limiting: Limited to 4 requests per minute.
Authentication: Requires the user to be authenticated (ensureAuthenticated).
Form Data:
image: The image file to upload. Supported formats: jpeg, jpg, png, gif.
Response:
Status: 200 OK - Image uploaded successfully.
Status: 400 Bad Request - Unsupported file type.
Status: 401 Unauthorized - User not authenticated.
Status: 429 Too Many Requests - Too many requests in a short time.
Example Response:
json

{
  "message": "Image uploaded successfully",
  "imageUrl": "https://medium.com/image-url"
}
Error Handling:
400 Bad Request - If the file type is not supported, an error message "Error: File type not supported" will be returned.
Rate Limiting Handler
If the rate limit exceeds, the following response will be sent:

json

{
  "message": "Too many requests, please try again later."
}
Middleware
mediumUrl: Middleware to handle Medium API URLs.
ensureAuthenticated: Middleware to ensure the user is authenticated before accessing protected routes.
express-rate-limit: Rate limiting middleware to limit the number of requests to the API endpoints (4 requests per minute).
Validators
validatePost: Validator middleware that ensures the title, content, and publishStatus fields are valid before creating a post.
Multer Configurations:
Image Uploading: The image uploader (multer) supports image formats jpeg, jpg, png, and gif. If the uploaded file is not one of these types, an error will be thrown.
