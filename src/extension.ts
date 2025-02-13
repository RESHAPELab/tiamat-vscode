import * as vscode from 'vscode';
import {post} from 'axios';
import * as fs from 'fs';
import {authenticateWithGitHub} from './auth';

const MAX_HISTORY_LENGTH = 6;
const GOOD = 1;
const BAD = 0;

export function activate(context: vscode.ExtensionContext) {
	// define a chat handler
    vscode.commands.registerCommand('tiamat.handleFeedback', async (args) => {
        try {
            console.log('Arguments:', args);
            const apiResponse = await post('http://localhost:5000/api/feedback', args);
            console.log('API Response:', apiResponse.data);
        } catch (error) {
            console.error('Error posting feedback:', error);
        }
    });

	const chatHandler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        stream.progress("Thinking...");
        console.log("User message:", request.prompt);
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

        let id = "0";
        try {
            id = await authenticateWithGitHub(context) ?? "0";
        } catch (error) {
            console.error('Error connecting:', error);
            
        }
        console.log("User ID:", id);

        try {
            const apiResponse = await post('http://localhost:5000/api/prompt', {id, code, message: request.prompt, history});
            stream.markdown(apiResponse.data.response);
            var args = {id: id, code: code, message: request.prompt, rating: GOOD, response: apiResponse.data.response};          
            stream.button({
                command: 'tiamat.handleFeedback',
                title: vscode.l10n.t('Good!'),
                arguments: [args]
              });
            var args = {id: id, code: code, message: request.prompt, rating: BAD, response: apiResponse.data.response};          
            stream.button({
              command: 'tiamat.handleFeedback',
              title: vscode.l10n.t('Bad!'),
              arguments: [args]
            });
        } catch (err) {
            console.log(err);
            stream.markdown("I'm sorry, I'm having trouble connecting to the server. Please try again later.");
            /*
                 These buttons are added for testing purposes when LLM server is down or for
                 rate limiting in my case, remove in production
            */
            args = {id: id, code: code, message: request.prompt, rating: GOOD, response: "bad response"};    
            stream.button({
                command: 'tiamat.handleFeedback',
                title: vscode.l10n.t('Good!'),
                arguments: [args]
              });
            args = {id: id, code: code, message: request.prompt, rating: BAD, response: "bad response"};   
            stream.button({
              command: 'tiamat.handleFeedback',
              title: vscode.l10n.t('Bad!'),
              arguments: [args],
            });
        }

		return;
	};

	// create participant
	const tutor = vscode.chat.createChatParticipant("tiamat.Tiamat", chatHandler);

	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}

export function deactivate() { }
