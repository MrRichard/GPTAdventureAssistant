document.addEventListener('DOMContentLoaded', () => {
    const downloadLogButton = document.getElementById('download-log-button');
    const uploadMapInput = document.getElementById('upload-map-input');
    const uploadMapButton = document.getElementById('upload-map-button');
    const insertTextButton = document.getElementById('insert-text-button');
    const storyTextBox = document.getElementById('story-text-box');
    const recordButton = document.getElementById('record-button');
    const oracleButton = document.getElementById('oracle-button');
    const characterButton = document.getElementById('create-npc-button')
    const settingButton = document.getElementById('create-setting-button')

    let mediaRecorder; // we will assign MediaRecorder object to this
    let audioChunks = []; // array for storing the recorded audio data

    // Track the current zoom level for the image
    let zoomLevel = 1;
    const ZOOM_STEP = 0.1; // Zoom increment step
    const MAX_ZOOM = 3;    // Maximum zoom level
    const MIN_ZOOM = 0.5;  // Minimum zoom level

    // On load, validate that we have a functional Open AI key
    fetch('/api_key_confirm', {
        method: 'GET'
    }).then(response => {
        if (!response.ok) {
            showApiKeyWarning();
            recordButton.disabled = true;
            downloadLogButton.disabled = true;

        }
        return response.json();
    }).catch(error => {
        showApiKeyWarning();
    });

    // Load existing content if it exists
    fetch('/load_session', { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSessionDialog();
            } else {
                loadDefaultMap(); // Continue with the default map load
            }
        })
        .catch(error => {
            console.error('Error checking for previous session:', error);
            loadDefaultMap();
        });

    function showSessionDialog() {
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.padding = '20px';
        dialog.style.backgroundColor = 'white';
        dialog.style.border = '1px solid black';
        dialog.style.zIndex = '1000'; // Ensure the dialog appears above other content

        const message = document.createElement('p');
        message.textContent = 'A previous session was found. Would you like to continue or start a new session?';
        dialog.appendChild(message);

        const continueButton = document.createElement('button');
        continueButton.textContent = 'Continue';
        continueButton.addEventListener('click', () => {
            loadSession();
            document.body.removeChild(dialog);
        });
        dialog.appendChild(continueButton);

        const newSessionButton = document.createElement('button');
        newSessionButton.textContent = 'New Session';
        newSessionButton.addEventListener('click', () => {
            archiveSession().then(() => {
                loadDefaultMap(); // Continue with the default map load
                document.body.removeChild(dialog);
            });
        });
        dialog.appendChild(newSessionButton);

        document.body.appendChild(dialog);
    }

    // Function to archive the existing session
    function archiveSession() {
        return fetch('/archive_session', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Session archived successfully.');
                } else {
                    console.error('Failed to archive session.');
                }
            })
            .catch(error => {
                console.error('Error archiving session:', error);
            });
    }

    // If there is environmental variable called OPENAI_API_KEY, then throw up this warning
    function showApiKeyWarning() {
        // Create a dialog box to warn the user
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.padding = '20px';
        dialog.style.backgroundColor = 'white';
        dialog.style.border = '1px solid red';
        dialog.style.zIndex = '1000'; // Ensure the dialog appears above other content

        const message = document.createElement('p');
        message.textContent = 'A valid OpenAI API key is required to use this application.\n';
        dialog.appendChild(message);

        // Create text box for API key input
        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'text';
        apiKeyInput.placeholder = 'Enter your OpenAI API key here';
        dialog.appendChild(apiKeyInput);

        // Create a submit button for the API key
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Submit';
        submitButton.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                submitNewApiKey(apiKey, dialog);
            } else {
                showBadApiKeyMessage(dialog);
            }
        });
        dialog.appendChild(submitButton);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        dialog.appendChild(closeButton);

        document.body.appendChild(dialog);
    }

    function showBadApiKeyMessage(dialog) {
        const badMessage = document.createElement('p');
        badMessage.textContent = 'Invalid API key. Please try again.';
        badMessage.style.color = 'red';
        dialog.appendChild(badMessage);
    }

    function submitNewApiKey(apiKey, dialog) {
        fetch('/add_new_api_key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ api_key: apiKey })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to add new API key');
                }
                // Validate the new API key
                return fetch('/api_key_confirm', {
                    method: 'GET'
                });
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // If the API key is valid, close the dialog and enable features
                    document.body.removeChild(dialog);
                    recordButton.disabled = false;
                    downloadLogButton.disabled = false;
                } else {
                    showBadApiKeyMessage(dialog);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showBadApiKeyMessage(dialog);
            });
    }

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
            const uploadResponse = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            // Extract the transcription from the server response
            const transcriptionData = await uploadResponse.json();
            const transcription = transcriptionData.text;

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

    // Function to remove all child elements of specific classes
    function removeChildElementsByClass(parent, className) {
        var elements = parent.querySelectorAll(`.${className}`);
        elements.forEach(function (element) {
            parent.removeChild(element);
        });
    }

    async function consultOracle() {
        try {
            // Send a POST request to the /oracle endpoint with the transcriptionText content
            let response = await fetch('/oracle', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Check if the response is ok (HTTP status code 200-299)
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Parse the JSON response
            let data = await response.json();
            // Handle the response data (for now, just log it to the console)
            //let now = new Date();
            //let timestamp = now.toLocaleString();

            let displayBox = document.createElement('div');
            displayBox.style.display = 'flex';
            displayBox.style.flexDirection = 'column';
            displayBox.style.justifyContent = 'center';
            displayBox.style.alignItems = 'center';
            displayBox.style.border = '1px solid black';
            displayBox.style.padding = '15px';
            displayBox.style.width = '250px';
            displayBox.style.position = 'absolute';
            displayBox.style.top = '50%';
            displayBox.style.left = '50%';
            displayBox.style.transform = 'translate(-50%, -50%)';
            displayBox.style.backgroundColor = 'white';
            displayBox.style.zIndex = '100';

            let textNode = document.createTextNode("The Oracle Speaks:" + data.response);
            displayBox.appendChild(textNode);

            let okButton = document.createElement('button');
            okButton.textContent = "Ok";
            okButton.style.marginTop = '15px';
            okButton.addEventListener('click', () => {
                document.body.removeChild(displayBox);
            });
            displayBox.appendChild(okButton);

            document.body.appendChild(displayBox);

            //make_message_bubble(timestamp, "The Oracle responds: " + data.response)

        } catch (error) {
            // Handle errors
            console.error('There was a problem with the fetch operation:', error);
        }
    };
    oracleButton.addEventListener('click', consultOracle);

    function make_message_bubble(timestamp, transcription, imagePath = null, hidden = false) {
        // Create a div to hold the new message bubble with the transcription
        let messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        // Function to hide message content
        function hideContent() {
            // Hide all children except the reveal button
            for (const child of messageBubble.children) {
                if (child.className !== 'reveal-button') {
                    child.style.display = 'none';
                } else {
                    child.style.display = 'block';
                }
            }
        }

        // Function to show message content
        function showContent() {
            for (const child of messageBubble.children) {
                child.style.display = 'block';
            }
        }

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

        // Create a button element to reveal or hide the content
        let revealButton = document.createElement('button');
        revealButton.className = 'reveal-button';
        revealButton.textContent = 'Reveal Secret';
        revealButton.addEventListener('click', () => {
            if (revealButton.textContent === 'Reveal Secret') {
                showContent();
                revealButton.textContent = 'Hide Secret';
            } else {
                hideContent();
                revealButton.textContent = 'Reveal Secret';
            }
        });

        // Append the timestamp, transcription text, and delete button to the message bubble
        messageBubble.appendChild(timestampSpan);
        messageBubble.appendChild(transcriptionText);
        messageBubble.appendChild(deleteButton);

        if (hidden) {
            messageBubble.appendChild(revealButton);
        }

        if (imagePath) {
            const img = document.createElement('img');
            img.src = imagePath;
            img.className = 'generated-image';
            img.alt = 'Generated Image';
            messageBubble.appendChild(img);
        }

        if (!hidden) {
            // Create a button element to submit the transcription text
            let submitButton = document.createElement('button');
            submitButton.className = 'submit-button';

            if (imagePath) {
                submitButton.textContent = 'Regen Image';
            } else {
                submitButton.textContent = 'Generate Image';
            }
            submitButton.addEventListener('click', async () => {
                let formData = new FormData();
                formData.append('text', transcription);
                submitButton.textContent = 'Generating Image';
                submitButton.disabled = true;
                try {
                    const response = await fetch('/generate_image', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error('Failed to generate image');
                    }

                    let imageData = await response.json();

                    // Check if messageBubble contains any <img> elements
                    if (messageBubble.querySelector('img')) {
                        console.log("Message bubble contains an image.");

                        // Remove all child elements of class "generated-image"
                        removeChildElementsByClass(messageBubble, 'generated-image');

                        // Remove all child elements of class "transcription-text"
                        removeChildElementsByClass(messageBubble, 'transcription-text');
                    }

                    // Create an image element to display the generated image
                    const img = document.createElement('img');
                    img.src = imageData.image_path;
                    img.className = 'generated-image';
                    img.alt = 'Generated Image';

                    // Create a span element to hold the transcription text below the image
                    const transcriptionSpan = document.createElement('span');
                    transcriptionSpan.className = 'transcription-text';
                    transcriptionSpan.style.fontStyle = 'italic';
                    transcriptionSpan.textContent = transcription;

                    // Reactivate button 
                    submitButton.textContent = 'Regen Img';
                    submitButton.disabled = false;

                    // Append the generated image and transcription span to the message bubble
                    messageBubble.appendChild(img);
                    messageBubble.appendChild(transcriptionSpan);

                    if (messageBubble.contains(transcriptionText)) {
                        messageBubble.removeChild(transcriptionText);
                    }

                    console.log('Image generated successfully with path:', imageData.file_path);

                } catch (error) {
                    submitButton.textContent = 'ERROR';
                    submitButton.disabled = true;
                    console.error('Error generating image:', error);
                }
            });

            // Append the submitButton only if not hidden
            messageBubble.appendChild(submitButton);
        }

        // Prepend the new message bubble to the existing content of the storyTextBox
        storyTextBox.prepend(messageBubble);

        // Initially hide content if hidden is true
        if (hidden) {
            revealButton.textContent = 'Reveal Secret';
            hideContent();
        }

        // After creating the message bubble and appending it to the storyTextBox
        saveSession();  // Call this function to save the session data to the server
    }

    // Helper function to remove child elements of a specific class
    function removeChildElementsByClass(parentElement, className) {
        let elements = parentElement.getElementsByClassName(className);
        while (elements.length > 0) {
            elements[0].parentNode.removeChild(elements[0]);
        }
    }


    function saveSession() {
        let bubbles = document.querySelectorAll('.message-bubble');
        let sessionData = Array.from(bubbles).map(bubble => {
            return {
                timestamp: bubble.querySelector('.timestamp').textContent,
                transcription: bubble.querySelector('.transcription-text').textContent,
                imagePath: bubble.querySelector('.generated-image') ? bubble.querySelector('.generated-image').src : null
            };
        });

        fetch('/save_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        }).then(response => response.json()).then(data => {
            if (data.success) {
                console.log('Session saved successfully.');
            }
        }).catch(error => {
            console.error('Error saving session:', error);
        });
    }

    function loadSession() {
        fetch('/load_session', {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            if (data.success && data.data) {
                const sessionData = data.data;
                sessionData.forEach(item => {
                    make_message_bubble(item.timestamp, item.transcription, item.imagePath);
                });
            }
        }).catch(error => {
            console.error('Error loading session:', error);
        });
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

    function showTextInputDialog() {
        // Create a dialog box
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.padding = '20px';
        dialog.style.backgroundColor = 'white';
        dialog.style.border = '1px solid black';
        dialog.style.zIndex = '1000'; // Ensure the dialog appears above other content
        dialog.style.minWidth = '200px';
        dialog.style.minHeight = '300px';

        const inputText = document.createElement('textarea');
        inputText.placeholder = 'Enter your message here';
        inputText.style.width = '100%'
        inputText.style.flex = '1';
        dialog.appendChild(inputText);

        setTimeout(() => inputText.focus(), 0); // Timeout to ensure dialog is in the DOM

        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', () => {
            const message = inputText.value.trim();
            if (message) {
                /// Get the current date and time
                let now = new Date();
                let timestamp = now.toLocaleString(); // This gives a human-readable date and time
                make_message_bubble(timestamp, message);
                document.body.removeChild(dialog);
            }
        });
        dialog.appendChild(acceptButton);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        dialog.appendChild(cancelButton);

        // Add keypress event listener to handle "Enter" key press
        inputText.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent the default action of adding a new line
                acceptButton.click(); // Trigger the accept button click event
            }
        });

        document.body.appendChild(dialog);
    }

    insertTextButton.addEventListener('click', showTextInputDialog);

    // Assuming you want to activate this function using a button with id 'download-log-button'
    downloadLogButton.addEventListener('click', downloadStoryBoxContent);

    loadDefaultMap();

    // Function to handle character generation on button click
    async function generateCharacter() {

        let now = new Date();
        let timestamp = now.toLocaleString();

        try {
            const response = await fetch('/character_generate', { method: 'GET' });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            const { physical_description, personality } = data;

            // Generate an image based on the physical description by calling the /generate_image endpoint
            let generatedImagePath;
            let formData = new FormData();
            formData.append('text', physical_description);
            try {
                const imageResponse = await fetch('/generate_image', {
                    method: 'POST',
                    body: formData
                });

                let imageData = await imageResponse.json();
                generatedImagePath = imageData.image_path; // Assuming the response contains the image path
                console.log(generatedImagePath)
            } catch (imageError) {
                // https://celebsonsandwiches.com/products/dr-steve-brule
                generatedImagePath = 'static/images/dr_brule.jpg'; // Fallback image path
            }

            make_message_bubble(timestamp, personality, '', true);
            make_message_bubble(timestamp, physical_description, generatedImagePath, false);
        } catch (error) {
            console.error('Failed to generate character:', error);
            generatedImagePath = 'static/images/dr_brule.jpg';
            make_message_bubble(timestamp, 'Failed to generate character, dude.', generatedImagePath, false);
        }
    }
    characterButton.addEventListener('click', generateCharacter);

    function showSettingsDialog() {
        // Create a dialog box
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.padding = '20px';
        dialog.style.backgroundColor = 'white';
        dialog.style.border = '1px solid black';
        dialog.style.zIndex = '1000'; // Ensure the dialog appears above other content
        dialog.style.minWidth = '200px';
        dialog.style.minHeight = '300px';

        // Create and set up the form elements
        const form = document.createElement('form');

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name of the place:';
        form.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'placeName';
        nameInput.style.width = '100%';
        form.appendChild(nameInput);

        const descLabel = document.createElement('label');
        descLabel.textContent = 'Short description:';
        form.appendChild(descLabel);

        const descTextArea = document.createElement('textarea');
        descTextArea.name = 'shortDescription';
        descTextArea.style.width = '100%';
        descTextArea.style.minHeight = '100px';
        form.appendChild(descTextArea);

        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Area size:';
        form.appendChild(sizeLabel);

        const smallAreaLabel = document.createElement('label');
        smallAreaLabel.textContent = 'Small area';
        form.appendChild(smallAreaLabel);

        const smallAreaRadio = document.createElement('input');
        smallAreaRadio.type = 'radio';
        smallAreaRadio.name = 'areaSize';
        smallAreaRadio.value = 'small';
        form.appendChild(smallAreaRadio);

        const largeAreaLabel = document.createElement('label');
        largeAreaLabel.textContent = 'Large area';
        form.appendChild(largeAreaLabel);

        const largeAreaRadio = document.createElement('input');
        largeAreaRadio.type = 'radio';
        largeAreaRadio.name = 'areaSize';
        largeAreaRadio.value = 'large';
        form.appendChild(largeAreaRadio);

        dialog.appendChild(form);

        // Accept button
        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent form submission
            const placeName = nameInput.value.trim();
            const shortDescription = descTextArea.value.trim();
            const areaSize = form.areaSize.value;

            if (placeName && shortDescription && areaSize) {
                // Perform necessary actions with the form data
                //console.log({ placeName, shortDescription, areaSize });

                try {
                    const response = await fetch('/generate_location', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ placeName, shortDescription, areaSize }),
                    });

                    if (response.ok) {
                        const data = await response.json();

                        // Create a message bubble with the public information
                        let now = new Date();
                        let timestamp = now.toLocaleString();
                        
                        make_message_bubble(timestamp,`Secret: ${data.secrets}`,'', true);                        
                        make_message_bubble(timestamp,`Place: ${data.placeName}\n\nDescription: ${data.longDescription}\n`, false);

                    } else {
                        console.error('Failed to fetch data from the server.');
                    }
                } catch (error) {
                    console.error('Error during fetch:', error);
                }

                document.body.removeChild(dialog);
            }
        });
        dialog.appendChild(acceptButton);

        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        dialog.appendChild(cancelButton);

        document.body.appendChild(dialog);
        setTimeout(() => nameInput.focus(), 0); // Timeout to ensure dialog is in the DOM
    }

    settingButton.addEventListener('click', showSettingsDialog);


});