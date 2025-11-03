/**
 * Tools Infrastructure Module
 *
 * Registers all tool implementations with the application layer.
 */

import { Module } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { ToolRegistry } from '@application/services/tool-registry.service';
import { FilesystemActor } from './actors/filesystem.actor';
import { TerminalActor } from './actors/terminal.actor';
import { HttpRequestActor } from './actors/http-request.actor';
import { InternalTodoActor } from './actors/internal-todo.actor';
import { LocalDBActor } from './actors/local-db.actor';
import { NotionActor } from './actors/notion.actor';
import { GoogleCalendarActor } from './actors/google-calendar.actor';
import { GoogleDriveActor } from './actors/google-drive.actor';
import { TodoistActor } from './actors/todoist.actor';
import { VirusTotalActor } from './actors/virustotal.actor';
import { MermaidActor } from './actors/mermaid.actor';
import { WolframRetriever } from './retrievers/wolfram.retriever';
import { FilesystemRetriever } from './retrievers/filesystem.retriever';
import { LocalDBRetriever } from './retrievers/localdb.retriever';
import { OCRRetriever } from './retrievers/ocr.retriever';

@Module({
  imports: [ApplicationModule],
  providers: [
    FilesystemActor,
    TerminalActor,
    HttpRequestActor,
    InternalTodoActor,
    LocalDBActor,
    NotionActor,
    GoogleCalendarActor,
    GoogleDriveActor,
    TodoistActor,
    VirusTotalActor,
    MermaidActor,
    WolframRetriever,
    FilesystemRetriever,
    LocalDBRetriever,
    OCRRetriever,
    // Register tool with ToolRegistry on module initialization
    {
      provide: 'TOOL_REGISTRATION',
      useFactory: (
        filesystemActor: FilesystemActor,
        terminalActor: TerminalActor,
        httpRequestActor: HttpRequestActor,
        internalTodoActor: InternalTodoActor,
        localDBActor: LocalDBActor,
        notionActor: NotionActor,
        googleCalendarActor: GoogleCalendarActor,
        googleDriveActor: GoogleDriveActor,
        todoistActor: TodoistActor,
        virusTotalActor: VirusTotalActor,
        mermaidActor: MermaidActor,
        wolframRetriever: WolframRetriever,
        filesystemRetriever: FilesystemRetriever,
        localDBRetriever: LocalDBRetriever,
        ocrRetriever: OCRRetriever,
        toolRegistry: ToolRegistry,
      ) => {
        // Register tools with the registry
        toolRegistry.registerTool(filesystemActor);
        toolRegistry.registerTool(terminalActor);
        toolRegistry.registerTool(httpRequestActor);
        toolRegistry.registerTool(internalTodoActor);
        toolRegistry.registerTool(localDBActor);
        toolRegistry.registerTool(notionActor);
        toolRegistry.registerTool(googleCalendarActor);
        toolRegistry.registerTool(googleDriveActor);
        toolRegistry.registerTool(todoistActor);
        toolRegistry.registerTool(virusTotalActor);
        toolRegistry.registerTool(mermaidActor);
        toolRegistry.registerTool(wolframRetriever);
        toolRegistry.registerTool(filesystemRetriever);
        toolRegistry.registerTool(localDBRetriever);
        toolRegistry.registerTool(ocrRetriever);
        return 'tools-registered';
      },
      inject: [
        FilesystemActor,
        TerminalActor,
        HttpRequestActor,
        InternalTodoActor,
        LocalDBActor,
        NotionActor,
        GoogleCalendarActor,
        GoogleDriveActor,
        TodoistActor,
        VirusTotalActor,
        MermaidActor,
        WolframRetriever,
        FilesystemRetriever,
        LocalDBRetriever,
        OCRRetriever,
        ToolRegistry,
      ],
    },
  ],
  exports: [
    FilesystemActor,
    TerminalActor,
    HttpRequestActor,
    InternalTodoActor,
    LocalDBActor,
    NotionActor,
    GoogleCalendarActor,
    GoogleDriveActor,
    TodoistActor,
    VirusTotalActor,
    MermaidActor,
    WolframRetriever,
    FilesystemRetriever,
    LocalDBRetriever,
    OCRRetriever,
  ],
})
export class ToolsInfrastructureModule {}
