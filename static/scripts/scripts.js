document.addEventListener('DOMContentLoaded', () => {
    const downloadLogButton = document.getElementById('download-log-button');
    const uploadMapInput = document.getElementById('upload-map-input');
    const uploadMapButton = document.getElementById('upload-map-button');
    const storyTextBox = document.getElementById('story-text-box');
    const mapContainer = document.getElementById('map-container');
    const recordButton = document.getElementById('record-button');

    let mediaRecorder; // we will assign MediaRecorder object to this
    let audioChunks = []; // array for storing the recorded audio data

    // Track the current zoom level for the image
    let zoomLevel = 1;
    const ZOOM_STEP = 0.1; // Zoom increment step
    const MAX_ZOOM = 3;    // Maximum zoom level
    const MIN_ZOOM = 0.5;  // Minimum zoom level

    function handleMapUpload() {
        const file = uploadMapInput.files[0]; // Get the first (and presumably only) file from the input

        if (!file) {
            console.error("No file selected for upload.");
            return;
        }

        let formData = new FormData();
        formData.append('map', file);

        // Upload the map image to the server
        fetch('/upload_map', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const uploadedFilePath = data.file_path; // Get the file path of the uploaded map image
                    const $mapContainer = $('#map-container');

                    const mapImage = $('<img>', {
                        src: uploadedFilePath,
                        css: {
                            position: 'absolute',
                            left: '0px',
                            top: '0px',
                            width: 'auto',
                            height: 'auto',
                            transform: `scale(${zoomLevel})` // Apply the initial zoom level
                        }
                    });

                    // Ensure the image loads properly before we append it
                    mapImage.on('load', function () {
                        $mapContainer.empty(); // Clear any existing content
                        $mapContainer.append(mapImage); // Append the new map image

                        // Apply zoom functionality
                        applyZoomFunctionality(mapImage[0]);

                        // Make the image draggable
                        makeImageDraggable(this); // Pass the DOM element to makeImageDraggable
                    });

                    mapImage.on('error', function () {
                        console.error("Failed to load the uploaded map image.");
                    });

                    // Reset the file input field
                    uploadMapInput.value = '';

                } else {
                    console.error("Failed to upload the map image.");
                }
            })
            .catch(error => {
                console.error("An error occurred while uploading the map image:", error);
            });
    }

    // Add the event listener for the upload map button
    uploadMapButton.addEventListener('click', handleMapUpload);

    /**
     * Function to load the default map image into the mapContainer using jQuery.
     * The image is loaded at its native resolution and scale.
     */
    function loadDefaultMap() {
        const $mapContainer = $('#map-container');
        const mapImage = $('<img>', {
            src: '/static/images/maps/sample_map.png',
            css: {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: 'auto',
                height: 'auto',
                transform: `scale(${zoomLevel})` // Apply the initial zoom level
            }
        });

        // Ensure the image loads properly before we append it
        mapImage.on('load', function () {
            $mapContainer.empty(); // Clear any existing content
            $mapContainer.append(mapImage); // Append the new map image

            // Apply zoom functionality
            applyZoomFunctionality(mapImage[0]);

            // Make the image draggable
            makeImageDraggable(this); // Pass the DOM element to makeImageDraggable
        });
        mapImage.on('error', function () {
            console.error("Failed to load the default map image.");
        });
    }

    /**
     * Function to add zoom in and out functionality to the map image using the mouse wheel.
     */
    function applyZoomFunctionality(mapImage) {
        mapImage.addEventListener('wheel', function (event) {
            event.preventDefault();

            if (event.deltaY < 0) {
                // Zoom in
                zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
            } else {
                // Zoom out
                zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
            }

            mapImage.style.transform = `scale(${zoomLevel})`;
        });
    }



    recordButton.addEventListener('mousedown', () => {
        startRecording();
    });

    recordButton.addEventListener('mouseup', async () => {
        await stopRecordingAndUpload();
    });


    /**
     * Function to start recording audio using the device's microphone.
     */
    function startRecording() {
        // Change the appearance of the record button to indicate recording is in progress
        recordButton.style.borderColor = 'red';
        recordButton.textContent = 'Recording';

        try {
            // Request access to the user's microphone
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Create a MediaRecorder instance and start recording
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.start();

                    // Event listener for handling the dataavailable event
                    // This event is fired whenever the MediaRecorder has data available
                    mediaRecorder.addEventListener("dataavailable", event => {
                        // Push the recorded audio data into the audioChunks array
                        audioChunks.push(event.data);
                    });
                    mediaRecorder.addEventListener("stop", () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        audioChunks = [];
                        uploadAudio(audioBlob);
                    });
                })
                .catch(error => {
                    // Handle any errors that occur while accessing the media devices
                    console.error("Error accessing media devices.", error);
                });
        } catch (error) {
            console.error("An error occurred during the recording process:", error);
            if (mediaRecorder) {
                console.log("stopping the recording.")
                mediaRecorder.stop();
            }
        }
    }

    /**
     * Stops the recording process and uploads the recorded audio.
     * This function handles ending the recording session, and then uploads 
     * the audio blob to the server and subsequently processes it with the OpenAI API.
     */
    async function stopRecordingAndUpload() {
        // Return early if there is no active mediaRecorder instance
        if (!mediaRecorder) return;

        // Change the appearance of the record button to indicate recording has stopped
        recordButton.style.borderColor = 'black';
        recordButton.textContent = 'Record';

        // Stop the media recorder to finish recording
        mediaRecorder.stop();
        audioChunks = [];
    }

    async function uploadAudio(audioBlob) {
        let formData = new FormData();
        const tmpFileName = Math.random().toString(36).substring(2, 15) + '.wav';
        const file = new File([audioBlob], tmpFileName, { type: "audio/wav" });
        formData.append('audio', file);

        try {
            const saveResponse = await fetch('/save_audio', {
                method: 'POST',
                body: formData
            });

            const saved_file = await saveResponse.json();
            formData = new FormData();
            formData.append('audio', saved_file.file_path);
            const uploadResponse = await fetch('/proxy_openai', {
                method: 'POST',
                body: formData
            });

            // Extract the transcription from the server response
            const transcriptionData = await uploadResponse.json();
            const transcription = transcriptionData.text;

            console.log(transcription)

            /// Get the current date and time
            let now = new Date();
            let timestamp = now.toLocaleString(); // This gives a human-readable date and time

            make_message_bubble(timestamp, transcription)

            // Call the delete_audio route to delete the tmp wav file used for this transcription
            formData = new FormData();
            formData.append('file_path', saved_file.file_path);
            await fetch('/delete_audio', {
                method: 'POST',
                body: formData
            });


        } catch (error) {
            console.error('Error:', error);
        }
    }

    function make_message_bubble(timestamp, transcription) {
        // Create a div to hold the new message bubble with the transcription
        let messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        // Create a span element to hold the timestamp
        let timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = `${timestamp}`;

        // Create a p element to hold the transcription text
        let transcriptionText = document.createElement('p');
        transcriptionText.className = 'transcription-text';
        transcriptionText.textContent = `${transcription}`;

        // Create a button element to delete the message bubble
        let deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            messageBubble.remove();
        });

        // Create a button element to submit the transcription text
        let submitButton = document.createElement('button');
        submitButton.className = 'submit-button';
        submitButton.textContent = 'I';
        submitButton.addEventListener('click', async () => {
            let formData = new FormData();
            formData.append('text', transcription);

            try {
                const response = await fetch('/generate_image', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Failed to generate image');
                }

                let imageData = await response.json();
                console.log(response.json())

                // Create an image element to display the generated image
                const img = document.createElement('img');
                img.src = imageData.image_path;
                img.className = 'generated-image'
                img.alt = 'Generated Image';

                // Enable dragging functionality
                makeImageDraggable(img);

                // Create a span element to hold the transcription text below the image
                const transcriptionSpan = document.createElement('span');
                transcriptionSpan.className = 'transcription-text';
                transcriptionSpan.style.fontStyle = 'italic';
                transcriptionSpan.textContent = transcription;

                // Append the generated image and transcription span to the message bubble
                messageBubble.appendChild(img);
                messageBubble.appendChild(transcriptionSpan);
                messageBubble.removeChild(transcriptionText)
                console.log('Image generated successfully with path:', imageData.file_path);

            } catch (error) {
                console.error('Error generating image:', error);
            }
        });

        // Append the timestamp, transcription text, submit button, and delete button to the message bubble
        messageBubble.appendChild(timestampSpan);
        messageBubble.appendChild(transcriptionText);
        messageBubble.appendChild(submitButton);
        messageBubble.appendChild(deleteButton);

        // Prepend the new message bubble to the existing content of the storyTextBox
        storyTextBox.prepend(messageBubble);
    }

    function makeImageDraggable(img) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        // Prevent default image dragging behavior
        img.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        img.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = img.offsetLeft;
            initialY = img.offsetTop;
            img.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                img.style.left = `${initialX + dx}px`;
                img.style.top = `${initialY + dy}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            img.style.cursor = 'grab';
        });
    }

    /**
     * Function to download the content of the story-text box as an HTML file.
     */
    async function downloadStoryBoxContent() {
        const storyTextBox = document.getElementById('story-text-box');
        const zip = new JSZip();

        // Folder within the zip
        const folder = zip.folder("story-text-box");

        // Extract images and replace the src links
        const imgElements = storyTextBox.getElementsByTagName('img');
        for (let i = 0; i < imgElements.length; i++) {
            let img = imgElements[i];
            let imgSrc = img.src;
            let imgName = `image${i}.png`;

            // Fetch the image as a blob
            const imgBlob = await fetch(imgSrc).then(r => r.blob());

            // Add the image to the folder
            folder.file(imgName, imgBlob);

            // Update the image src attribute to the path relative to the ZIP structure
            img.src = `./${imgName}`;
        }

        // Create a new Blob containing the modified HTML content of the storyTextBox
        folder.file("story-text-box.html", storyTextBox.innerHTML, { type: 'text/html' });

        // Generate the zip file and trigger the download
        zip.generateAsync({ type: 'blob' }).then((content) => {
            const zipBlobURL = URL.createObjectURL(content);

            const downloadLink = document.createElement('a');
            downloadLink.download = 'story-text-box.zip';
            downloadLink.href = zipBlobURL;

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });
    }

    // Assuming you want to activate this function using a button with id 'download-log-button'
    downloadLogButton.addEventListener('click', downloadStoryBoxContent);

    loadDefaultMap();

});