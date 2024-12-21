import React, { useState } from 'react';
import axios from 'axios';
import Message from "./Message";
import { Box, Button, Checkbox, FormControlLabel, TextField } from '@mui/material';

const Conversation = () => {
    const [prompt, setPrompt] = useState("");
    const [testMode, setTestMode] = useState(false);
    const [messageHistory, setMessageHistory] = useState([]);
    const [enabled, setEnabled] = useState(true);

    const testMessages = [
        "**Hello!** This is a *quick test* with a [link](https://example.com).",
        "Testing **bold text** and *italic text*!",
        "Markdown works great!"
    ];

    const sendMessage = async () => {
        if (enabled && prompt.trim()) {
            setEnabled(false);
            setMessageHistory((prev) => [{ speaker: "You", content: prompt.trim() }, ...prev]);
            setPrompt("");

            const response = testMode
                ? testMessages[Math.floor(Math.random() * testMessages.length)]
                : "Simulated response from assistant";

            setMessageHistory((prev) => [{ speaker: "Tiamat", content: response }, ...prev]);
            setEnabled(true);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 700, margin: 'auto', mt: 5, p: 2 }}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={testMode}
                        onChange={() => setTestMode(!testMode)}
                    />
                }
                label="Test Mode"
            />
            <Box sx={{ 
                height: 400, 
                overflowY: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: 2, 
                p: 2,
                backgroundColor: '#f9f9f9',
                mb: 2
            }}>
                {messageHistory.map((message, index) => (
                    <Message key={index} speaker={message.speaker} content={message.content} />
                ))}
            </Box>
            <TextField
                fullWidth
                multiline
                minRows={3}
                variant="outlined"
                placeholder="Type your message here"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="contained" onClick={sendMessage} sx={{ px: 4 }}>Send</Button>
                <Button variant="outlined">Export</Button>
            </Box>
        </Box>
    );
};

export default Conversation;
