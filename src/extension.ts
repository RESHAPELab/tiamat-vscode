import * as vscode from 'vscode';
import {post} from 'axios';
import * as fs from 'fs';
import {authenticateWithGitHub} from './auth';

const MAX_HISTORY_LENGTH = 6;

export function activate(context: vscode.ExtensionContext) {
	// define a chat handler
	const chatHandler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        stream.progress("Thinking...");
        console.log("Token:", token);
        console.log("References:", request.references);
        console.log("Context:", chatContext);

        let code = "";

        console.log("\nRelevant references: ");
        
        request.references.forEach((ref) => {
            if (ref.value instanceof vscode.Location) {
                console.log(ref, "is a Location");
                console.log(ref.id, "-", ref.value);

                const uri = ref.value.uri;
                const range = ref.value.range;

                const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === uri.fsPath);

                if (document) {
                    const fileName = uri.path.split("/").pop();
                    code += (ref.modelDescription || "File provided for context") + " (" + fileName + ")" + ":\n" + document?.getText(range);
                }
            } else if (ref.value instanceof vscode.Uri) {
                console.log(ref, "is a URI");
                console.log(ref.id, "-", ref.value);

                const uri = ref.value;

                const fileContent = fs.readFileSync(uri.fsPath, 'utf8');

                console.log("File content:", fileContent);

                const fileName = uri.path.split("/").pop();
                code += "\n" + (ref.modelDescription || "File provided for context") + " (" + fileName + ")" + ":\n" + fileContent + "\n";
            }
        });

        console.log("Final code:");
        console.log(code);

        let history: string[] = [];

        chatContext.history.slice(-MAX_HISTORY_LENGTH).forEach((item) => {
            if (item instanceof vscode.ChatRequestTurn) {
                history.push("User: " + item.prompt);
            } else if (item instanceof vscode.ChatResponseTurn) {
                let fullMessage = '';
                item.response.forEach(r => {
                    const mdPart = r as vscode.ChatResponseMarkdownPart;
                    fullMessage += mdPart.value.value;
                });

                history.push("Tiamat: " + fullMessage);
            }
        });

        console.log("Chat history:", history);

        let id = await authenticateWithGitHub(context);
        console.log("User ID:", id);

        try {
            const apiResponse = await post('http://localhost:5000/api/prompt', {id, code, message: request.prompt, history});
            stream.markdown(apiResponse.data.response);
        } catch (err) {
            console.log(err);
            stream.markdown("I'm sorry, I'm having trouble connecting to the server. Please try again later.");
        }

		return;
	};

    const handleFeedback = (feedback: vscode.ChatResultFeedback) => {
        console.log('Feedback received:', feedback);

        switch (feedback.kind) {
            case vscode.ChatResultFeedbackKind.Helpful:
                vscode.window.showInformationMessage('Happy that you liked it.');
                break;
            case vscode.ChatResultFeedbackKind.Unhelpful:
                vscode.window.showWarningMessage('Sorry that you didn\'t like our response.');
                break;
            default:
                vscode.window.showInformationMessage('Received feedback.');
                break;
        }
    };

	// create participant
	const tutor = vscode.chat.createChatParticipant("tiamat.Tiamat", chatHandler);

    // Handle thumbs up and down feedback
    tutor.onDidReceiveFeedback(handleFeedback);

	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}

export function deactivate() { }
