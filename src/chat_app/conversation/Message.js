import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, Typography } from '@mui/material';

const Message = (props) => {
    return (
        <Card 
            sx={{ 
                mb: 1, 
                boxShadow: 3, 
                borderRadius: 2, 
                backgroundColor: props.speaker === 'You' ? '#e3f2fd' : '#fce4ec',
                maxWidth: '90%',
                marginLeft: props.speaker === 'You' ? 'auto' : '0'
            }}
        >
            <CardContent>
                <Typography 
                    variant="subtitle2" 
                    sx={{ fontWeight: 'bold', color: 'text.secondary' }}
                >
                    {props.speaker}
                </Typography>
                <ReactMarkdown>{props.content}</ReactMarkdown>
            </CardContent>
        </Card>
    );
};

export default Message;
