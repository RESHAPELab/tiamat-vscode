import * as vscode from 'vscode';
import {post} from 'axios';

export function activate(context: vscode.ExtensionContext) {

	// define a chat handler
	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        stream.progress("Thinking...");
        console.log(token);
        
        try {
            const apiResponse = await post('http://localhost:5000/api/prompt', {id: '1', message: request.prompt});
            stream.markdown(apiResponse.data.response);
        } catch (err) {
            console.log(err);
            stream.markdown("I'm sorry, I'm having trouble connecting to the server. Please try again later.");
        }

		return;
	};

	// create participant
	const tutor = vscode.chat.createChatParticipant("tiamat.Tiamat", handler);

	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}

export function deactivate() { }
