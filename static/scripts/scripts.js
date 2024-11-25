document.addEventListener('DOMContentLoaded', () => {
    // =========================================
    // UI Element Initialization
    // =========================================
    const uiElements = {
        downloadLogButton: document.getElementById('download-log-button'),
        uploadMapInput: document.getElementById('upload-map-input'),
        uploadMapButton: document.getElementById('upload-map-button'),
        insertTextButton: document.getElementById('insert-text-button'),
        storyTextBox: document.getElementById('story-text-box'),
        recordButton: document.getElementById('record-button'),
        oracleButton: document.getElementById('oracle-button'),
        characterButton: document.getElementById('create-npc-button'),
        settingButton: document.getElementById('create-setting-button')
    };

    // =========================================
    // State Management
    // =========================================
    let mediaRecorder = null;
    let audioChunks = [];

    // Map settings
    let zoomLevel = 1;
    const ZOOM_STEP = 0.1;
    const MAX_ZOOM = 3;
    const MIN_ZOOM = 0.5;

    // =========================================
    // Message Bubble Class Definition
    // =========================================
    class MessageBubble {
        constructor(timestamp, content, options = {}) {
            this.timestamp = timestamp;
            this.content = content;
            this.options = {
                imagePath: options.imagePath || null,
                isHidden: options.isHidden || false,
                imageGenMode: options.imageGenMode || '',
                containerSelector: options.containerSelector || '#story-text-box'
            };
            this.element = null;
        }

        createBubbleElement() {
            this.element = document.createElement('div');
            this.element.className = 'message-bubble';

            // Add timestamp
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            timestampSpan.textContent = this.timestamp;
            this.element.appendChild(timestampSpan);

            // Add content
            const contentP = document.createElement('p');
            contentP.className = 'transcription-text';
            contentP.textContent = this.content;
            this.element.appendChild(contentP);

            // Add image if provided
            if (this.options.imagePath) {
                this.addImage(this.options.imagePath);
            }

            // Add buttons
            this.addButtons();

            return this.element;
        }

        addButtons() {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';

            // Delete button is always present
            const deleteButton = this.createButton('Delete', 'delete-button', () => {
                this.element.remove();
                this.triggerSaveSession();
            });
            buttonContainer.appendChild(deleteButton);

            // Hidden content handling
            if (this.options.isHidden) {
                const revealButton = this.createButton('Reveal Secret', 'reveal-button', () => {
                    this.toggleContent(revealButton);
                });
                buttonContainer.appendChild(revealButton);
                this.hideContent();
            } else {
                // Image generation button
                const imageButton = this.createButton(
                    this.getImageButtonText(),
                    'submit-button',
                    () => this.handleImageGeneration()
                );
                buttonContainer.appendChild(imageButton);
            }

            this.element.appendChild(buttonContainer);
        }

        createButton(text, className, clickHandler) {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = `bubble-button ${className}`;
            button.addEventListener('click', clickHandler);
            return button;
        }

        getImageButtonText() {
            if (this.options.imagePath) {
                return 'Regen Image';
            }
            switch (this.options.imageGenMode) {
                case 'person': return 'Portrait';
                case 'place': return 'Map';
                default: return 'Generate Image';
            }
        }

        async handleImageGeneration() {
            const button = this.element.querySelector('.submit-button');
            button.textContent = 'Generating Image...';
            button.disabled = true;

            try {
                const formData = new FormData();
                formData.append('text', this.content);
                if (this.options.imageGenMode) {
                    formData.append('object', this.options.imageGenMode);
                }

                const response = await fetch('/generate_image', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Failed to generate image');

                const imageData = await response.json();
                this.updateWithNewImage(imageData.image_path);

                button.textContent = 'Regen Image';
                button.disabled = false;
            } catch (error) {
                console.error('Error generating image:', error);
                button.textContent = 'ERROR';
                button.disabled = true;
            }
        }

        updateWithNewImage(imagePath) {
            // Remove existing image and text if present
            this.element.querySelectorAll('.generated-image, .transcription-text').forEach(el => el.remove());

            // Add new image and text
            this.addImage(imagePath);
            
            const transcriptionSpan = document.createElement('span');
            transcriptionSpan.className = 'transcription-text';
            transcriptionSpan.style.fontStyle = 'italic';
            transcriptionSpan.textContent = this.content;
            this.element.insertBefore(transcriptionSpan, this.element.querySelector('.button-container'));

            this.triggerSaveSession();
        }

        addImage(imagePath) {
            const img = document.createElement('img');
            img.src = imagePath;
            img.className = 'generated-image';
            img.alt = 'Generated Image';
            this.element.insertBefore(img, this.element.querySelector('.button-container'));
        }

        hideContent() {
            Array.from(this.element.children).forEach(child => {
                if (!child.classList.contains('reveal-button')) {
                    child.style.display = 'none';
                }
            });
        }

        toggleContent(revealButton) {
            const isHidden = revealButton.textContent === 'Reveal Secret';
            Array.from(this.element.children).forEach(child => {
                if (!child.classList.contains('reveal-button')) {
                    child.style.display = isHidden ? 'block' : 'none';
                }
            });
            revealButton.textContent = isHidden ? 'Hide Secret' : 'Reveal Secret';
        }

        triggerSaveSession() {
            const event = new CustomEvent('savesession', { bubbles: true });
            this.element.dispatchEvent(event);
        }

        static addToContainer(bubble) {
            const container = document.querySelector(bubble.options.containerSelector);
            if (container) {
                container.prepend(bubble.createBubbleElement());
                bubble.triggerSaveSession();
            }
        }
    }

    // =========================================
    // API & Session Management Functions
    // =========================================
    async function checkApiKey() {
        try {
            const response = await fetch('/api_key_confirm', { method: 'GET' });
            if (!response.ok) {
                const data = await response.json();
                showApiKeyWarning();
                uiElements.recordButton.disabled = true;
                uiElements.downloadLogButton.disabled = true;
            }
        } catch (error) {
            console.error('Error checking API key:', error);
            showApiKeyWarning();
        }
    }

    async function loadExistingSession() {
        try {
            const response = await fetch('/load_session', { method: 'GET' });
            const data = await response.json();
            if (data.success) {
                showSessionDialog();
            } else {
                loadDefaultMap();
            }
        } catch (error) {
            console.error('Error checking for previous session:', error);
            loadDefaultMap();
        }
    }

    // =========================================
    // Audio Recording Functions
    // =========================================
    async function startRecording() {
        try {
            uiElements.recordButton.style.borderColor = 'red';
            uiElements.recordButton.textContent = 'Recording';

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                audioChunks = [];
                uploadAudio(audioBlob);
            });
        } catch (error) {
            console.error("Error accessing media devices:", error);
            if (mediaRecorder) {
                mediaRecorder.stop();
            }
        }
    }

    async function stopRecordingAndUpload() {
        if (!mediaRecorder) return;

        uiElements.recordButton.style.borderColor = 'black';
        uiElements.recordButton.textContent = 'Record';
        mediaRecorder.stop();
        audioChunks = [];
    }

    async function uploadAudio(audioBlob) {
        const formData = new FormData();
        const tmpFileName = Math.random().toString(36).substring(2, 15) + '.wav';
        const file = new File([audioBlob], tmpFileName, { type: "audio/wav" });
        formData.append('audio', file);

        try {
            // Save audio file
            const saveResponse = await fetch('/save_audio', {
                method: 'POST',
                body: formData
            });
            const savedFile = await saveResponse.json();

            // Transcribe audio
            const transcribeFormData = new FormData();
            transcribeFormData.append('audio', savedFile.file_path);
            const transcribeResponse = await fetch('/transcribe', {
                method: 'POST',
                body: transcribeFormData
            });

            const transcriptionData = await transcribeResponse.json();
            const timestamp = new Date().toLocaleString();
            
            // Create message bubble with transcription
            createMessageBubble(timestamp, transcriptionData.text);

            // Cleanup temporary file
            const cleanupFormData = new FormData();
            cleanupFormData.append('file_path', savedFile.file_path);
            await fetch('/delete_audio', {
                method: 'POST',
                body: cleanupFormData
            });
        } catch (error) {
            console.error('Error processing audio:', error);
            createErrorMessage('Failed to process audio recording');
        }
    }

    // =========================================
    // Map Management Functions
    // =========================================
    function loadDefaultMap() {
        const mapContainer = $('#map-container');
        const mapImage = $('<img>', {
            src: '/static/images/maps/sample_map.png',
            css: {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: 'auto',
                height: 'auto',
                transform: `scale(${zoomLevel})`
            }
        });

        mapImage.on('load', function() {
            mapContainer.empty();
            mapContainer.append(mapImage);
            applyZoomFunctionality(mapImage[0]);
            makeImageDraggable(this);
        });
    }

    function handleMapUpload() {
        const file = uiElements.uploadMapInput.files[0];
        if (!file) {
            createErrorMessage("No file selected for upload.");
            return;
        }

        const formData = new FormData();
        formData.append('map', file);

        fetch('/upload_map', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateMapDisplay(data.file_path);
            } else {
                createErrorMessage("Failed to upload map image.");
            }
        })
        .catch(error => {
            console.error("Map upload error:", error);
        createErrorMessage("Error uploading map.");
        });
    }

    function updateMapDisplay(filePath) {
        const mapContainer = document.getElementById('map-container');
        mapContainer.innerHTML = ''; // Clear current map display
    
        const mapImage = document.createElement('img');
        mapImage.src = filePath;
        mapImage.style.position = 'absolute';
        mapImage.style.left = '0px';
        mapImage.style.top = '0px';
        mapImage.style.width = 'auto';
        mapImage.style.height = 'auto';
        mapImage.style.transform = `scale(${zoomLevel})`;
    
        mapImage.onload = function() {
            applyZoomFunctionality(mapImage);
            makeImageDraggable(mapImage);
        };
    
        mapContainer.appendChild(mapImage);
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
        // Get the current date and time
                let now = new Date();
                let timestamp = now.toLocaleString(); // This gives a human-readable date and time

        // Create a new MessageBubble instance and add it to the container
        const bubble = new MessageBubble(timestamp, message);
        MessageBubble.addToContainer(bubble);

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

        } catch (error) {
            // Handle errors
            console.error('There was a problem with the fetch operation:', error);
        }
    };

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
            formData.append('object', 'person');

            try {
                const imageResponse = await fetch('/generate_image', {
                    method: 'POST',
                    body: formData
                });

                let imageData = await imageResponse.json();
                generatedImagePath = imageData.image_path; // Assuming the response contains the image path
                console.log(generatedImagePath)
            } catch (imageError) {
                generatedImagePath = 'static/images/dr_brule.jpg'; // Fallback image path
            }

            createMessageBubble(timestamp, personality, {
                isHidden: true
            });
            
            createMessageBubble(timestamp, physical_description, {
                imagePath: generatedImagePath,
                isHidden: false,
                imageGenMode: 'person'
            });
        } catch (error) {
            console.error('Failed to generate character:', error);
            generatedImagePath = 'static/images/dr_brule.jpg';
            createMessageBubble(timestamp, 'Failed to generate character, dude.', { imagePath: generatedImagePath, isHidden: false });
        }
    }

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
                        
                        createMessageBubble(timestamp, `Secret: ${data.secrets}`, {
                            isHidden: true
                        });
                        createMessageBubble(timestamp, `Place: ${data.placeName}\n\nDescription: ${data.longDescription}\n`, {
                            isHidden: false,
                            imageGenMode: 'place'
                        });

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

    async function loadSession() {
        try {
            const response = await fetch('/load_session', { method: 'GET' });
            const data = await response.json();
            if (data.success && data.data) {
                data.data.forEach(item => {
                    createMessageBubble(item.timestamp, item.transcription, { imagePath: item.imagePath });
                });
            }
        } catch (error) {
            console.error('Error loading session:', error);
        }
    }

    // =========================================
    // Utility Functions
    // =========================================
    function createErrorMessage(message) {
        const timestamp = new Date().toLocaleString();
        createMessageBubble(timestamp, `Error: ${message}`, { isError: true });
    }

    function createMessageBubble(timestamp, content, options = {}) {
        const bubble = new MessageBubble(timestamp, content, {
            imagePath: options.imagePath,
            isHidden: options.isHidden,
            imageGenMode: options.imageGenMode,
            containerSelector: '#story-text-box'
        });
        MessageBubble.addToContainer(bubble);
    }

    // =========================================
    // Event Listeners
    // =========================================
    document.addEventListener('savesession', () => {
        const bubbles = document.querySelectorAll('.message-bubble');
        const sessionData = Array.from(bubbles).map(bubble => ({
            timestamp: bubble.querySelector('.timestamp').textContent,
            transcription: bubble.querySelector('.transcription-text').textContent,
            imagePath: bubble.querySelector('.generated-image')?.src || null
        }));

        fetch('/save_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Session saved successfully.');
            }
        })
        .catch(error => console.error('Error saving session:', error));
    });

    // Button event listeners
    uiElements.recordButton.addEventListener('mousedown', startRecording);
    uiElements.recordButton.addEventListener('mouseup', stopRecordingAndUpload);
    uiElements.uploadMapButton.addEventListener('click', handleMapUpload);
    uiElements.insertTextButton.addEventListener('click', showTextInputDialog);
    uiElements.downloadLogButton.addEventListener('click', downloadStoryBoxContent);
    uiElements.oracleButton.addEventListener('click', consultOracle);
    uiElements.characterButton.addEventListener('click', generateCharacter);
    uiElements.settingButton.addEventListener('click', showSettingsDialog);

    // =========================================
    // Initialization
    // =========================================
    checkApiKey();
    loadExistingSession();
});
