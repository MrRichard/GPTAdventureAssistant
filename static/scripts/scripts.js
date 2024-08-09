document.addEventListener('DOMContentLoaded', () => {
    const downloadLogButton = document.getElementById('download-log-button');
    const uploadMapInput = document.getElementById('upload-map-input');
    const uploadMapButton = document.getElementById('upload-map-button');
    const storyTextBox = document.getElementById('story-text-box');
    const mapContainer = document.getElementById('map-container');
    const recordButton = document.getElementById('record-button');

    let mediaRecorder; // we will assign MediaRecorder object to this
    let audioChunks = []; // array for storing the recorded audio data

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
                        height: 'auto'
                    }
                });

                // Ensure the image loads properly before we append it
                mapImage.on('load', function() {
                    $mapContainer.empty(); // Clear any existing content
                    $mapContainer.append(mapImage); // Append the new map image

                    // Make the image draggable
                    makeImageDraggable(this); // Pass the DOM element to makeImageDraggable
                });

                mapImage.on('error', function() {
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
                height: 'auto'
            }
        });

        // Ensure the image loads properly before we append it
        mapImage.on('load', function() {
            $mapContainer.empty(); // Clear any existing content
            $mapContainer.append(mapImage); // Append the new map image

            // Make the image draggable
            makeImageDraggable(this); // Pass the DOM element to makeImageDraggable
        });
        mapImage.on('error', function() {
            console.error("Failed to load the default map image.");
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

            // Format the new text with the timestamp
            let newText = `${timestamp} - ${transcription}\n`;

            // Prepend the new text to the existing content of the storyTextBox
            storyTextBox.innerText = newText + storyTextBox.innerText;

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
    function downloadStoryBoxContent() {
        // Get the storyTextBox element by its id
        const storyTextBox = document.getElementById('story-text-box');

        // Create a new Blob containing the HTML content of the storyTextBox
        const storyHtmlContent = new Blob([storyTextBox.innerHTML], {
            type: 'text/html'
        });

        // Create a new URL for the Blob
        const storyHtmlURL = URL.createObjectURL(storyHtmlContent);

        // Create a new anchor element
        const downloadLink = document.createElement('a');

        // Set the download attribute with a filename
        downloadLink.download = 'story-text-box.html';

        // Set the href of the anchor to the Blob URL
        downloadLink.href = storyHtmlURL;

        // Append the anchor to the body (this is necessary for Firefox)
        document.body.appendChild(downloadLink);

        // Programmatically click the anchor to trigger the download
        downloadLink.click();

        // Remove the anchor from the DOM
        document.body.removeChild(downloadLink);

        // Revoke the Blob URL to free up resources
        URL.revokeObjectURL(storyHtmlURL);
    }

    // Assuming you want to activate this function using a button with id 'download-button'
    downloadLogButton.addEventListener('click', downloadStoryBoxContent);

    loadDefaultMap();

});