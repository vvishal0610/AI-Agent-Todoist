import { TodoistApi } from "@doist/todoist-api-typescript";

// Securely retrieve the API token from environment variables
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;
if (!TODOIST_API_TOKEN) {
    console.error("FATAL: TODOIST_API_TOKEN environment variable not set.");
    process.exit(1);
}

const todoistApi = new TodoistApi(TODOIST_API_TOKEN);

// Manual stdio handling
let buffer = '';

process.stdin.setEncoding('utf-8');

// Handle incoming messages
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let boundary;
    
    // Process all complete messages in the buffer, delimited by '\0'
    while ((boundary = buffer.indexOf('\0')) !== -1) {
        const message = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);
        
        if (message) {
            handleMessage(message);
        }
    }
});

process.stdin.on('end', () => {
    process.exit(0);
});

// Send a response back to Python
function sendResponse(response) {
    const message = JSON.stringify(response) + '\0';
    process.stdout.write(message);
}

// Handle incoming JSON-RPC messages
async function handleMessage(messageStr) {
    try {
        const request = JSON.parse(messageStr);
        
        // Handle the tools/call method
        if (request.method === 'tools/call') {
            const { name, arguments: args } = request.params;
            
            if (name === 'create_task') {
                try {
                    // Call the Todoist API
                    const task = await todoistApi.addTask({ content: args.content });
                    
                    // Send success response
                    sendResponse({
                        jsonrpc: '2.0',
                        id: request.id,
                        result: {
                            content: {
                                type: 'text',
                                text: `Successfully created task "${task.content}" with ID: ${task.id}`
                            }
                        }
                    });
                } catch (error) {
                    console.error(`Todoist API Error:`, error);
                    
                    // Send error response
                    sendResponse({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: {
                            code: -32603,
                            message: `Failed to create task: ${error.message}`
                        }
                    });
                }
            } else {
                // Unknown tool
                sendResponse({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                        code: -32601,
                        message: `Unknown tool: ${name}`
                    }
                });
            }
        } else {
            // Unknown method
            sendResponse({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32601,
                    message: `Unknown method: ${request.method}`
                }
            });
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

// Log ready message
console.error('MCP Todoist Server is running and listening on stdio.');