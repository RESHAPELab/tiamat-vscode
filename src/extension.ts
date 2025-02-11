import * as vscode from 'vscode';
import {post} from 'axios';
import * as fs from 'fs';

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

	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        stream.progress("Thinking...");
        console.log("User message:", request.prompt);
        console.log("Token:", token);
        console.log("References:", request.references);
        console.log("Context:", context);

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

        try {  
            const apiResponse = await post('http://localhost:5000/api/prompt', {id: '1', code, message: request.prompt});
            stream.markdown(apiResponse.data.response);
            var args = {id: '1', code: code, message: request.prompt, rating: 'good', response: apiResponse.data.response};          
            stream.button({
                command: 'tiamat.handleFeedback',
                title: vscode.l10n.t('Good!'),
                arguments: [args]
              });
            var args = {id: '1', code: code, message: request.prompt, rating: 'bad', response: apiResponse.data.response};          
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
            args = {id: '1', code: code, message: request.prompt, rating: 'good', response: "bad response"};    
            stream.button({
                command: 'tiamat.handleFeedback',
                title: vscode.l10n.t('Good!'),
                arguments: [args]
              });
            args = {id: '1', code: code, message: request.prompt, rating: 'bad', response: "bad response"};   
            stream.button({
              command: 'tiamat.handleFeedback',
              title: vscode.l10n.t('Bad!'),
              arguments: [args],
            });
        }

		return;
	};

	// create participant
	const tutor = vscode.chat.createChatParticipant("tiamat.Tiamat", handler);

	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}

export function deactivate() { }
