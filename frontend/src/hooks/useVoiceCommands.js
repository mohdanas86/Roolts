
import React, { useState, useEffect, useCallback } from 'react';

export const useVoiceCommands = (commands = {}) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
    const [recognition, setRecognition] = useState(null);

    const commandsRef = React.useRef(commands);

    // Update ref when commands change
    useEffect(() => {
        commandsRef.current = commands;
    }, [commands]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognitionInstance = new SpeechRecognition();
            recognitionInstance.continuous = false; // Stop after one command usually better for control
            recognitionInstance.lang = 'en-US';
            recognitionInstance.interimResults = false;

            recognitionInstance.onstart = () => {
                setIsListening(true);
                setFeedback({ type: 'info', message: 'Listening...' });
            };

            recognitionInstance.onend = () => {
                setIsListening(false);
            };

            recognitionInstance.onresult = (event) => {
                const last = event.results.length - 1;
                const text = event.results[last][0].transcript.toLowerCase().trim();
                setTranscript(text);

                console.log('Voice Command:', text);

                // Match command
                let matched = false;

                // Direct match or "sounds like" match
                // Use ref current value
                for (const [command, action] of Object.entries(commandsRef.current)) {
                    if (text.includes(command.toLowerCase())) {
                        action();
                        setFeedback({ type: 'success', message: `Executed: "${command}"` });
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    setFeedback({ type: 'warning', message: `Unknown command: "${text}"` });
                }
            };

            recognitionInstance.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setFeedback({ type: 'error', message: `Error: ${event.error}` });
                setIsListening(false);
            };

            setRecognition(recognitionInstance);
        } else {
            setFeedback({ type: 'error', message: 'Voice control not supported in this browser.' });
        }
    }, []); // Empty dependency array - only initialize once!

    const toggleListening = useCallback(() => {
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error("Failed to start recognition", e);
            }
        }
    }, [isListening, recognition]);

    return {
        isListening,
        transcript,
        feedback,
        toggleListening,
        isSupported: !!recognition
    };
};
