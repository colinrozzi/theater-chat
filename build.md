src/MultiLineInput.tsx(79,5): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(80,5): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(92,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(93,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(99,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(107,5): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(122,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/MultiLineInput.tsx(122,20): error TS2345: Argument of type '"normal"' is not assignable to parameter of type '"insert" | "command"'.
src/MultiLineInput.tsx(137,13): error TS2339: Property 'home' does not exist on type 'Key'.
src/MultiLineInput.tsx(142,13): error TS2339: Property 'end' does not exist on type 'Key'.
src/theater.ts(249,5): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/theater.ts(250,26): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/ui.tsx(74,35): error TS7006: Parameter 'role' implicitly has an 'any' type.
src/ui.tsx(74,41): error TS7006: Parameter 'content' implicitly has an 'any' type.
src/ui.tsx(78,44): error TS7006: Parameter 'messageIndex' implicitly has an 'any' type.
src/ui.tsx(78,58): error TS7006: Parameter 'status' implicitly has an 'any' type.
src/ui.tsx(84,42): error TS7006: Parameter 'role' implicitly has an 'any' type.
src/ui.tsx(84,48): error TS7006: Parameter 'content' implicitly has an 'any' type.
src/ui.tsx(90,39): error TS7006: Parameter 'toolName' implicitly has an 'any' type.
src/ui.tsx(90,49): error TS7006: Parameter 'toolArgs' implicitly has an 'any' type.
src/ui.tsx(91,17): error TS2345: Argument of type '(prev: Message[]) => (Message | { role: string; content: any; toolName: any; toolArgs: any; status: string; })[]' is not assignable to parameter of type 'SetStateAction<Message[]>'.
  Type '(prev: Message[]) => (Message | { role: string; content: any; toolName: any; toolArgs: any; status: string; })[]' is not assignable to type '(prevState: Message[]) => Message[]'.
    Type '(Message | { role: string; content: any; toolName: any; toolArgs: any; status: string; })[]' is not assignable to type 'Message[]'.
      Type 'Message | { role: string; content: any; toolName: any; toolArgs: any; status: string; }' is not assignable to type 'Message'.
        Type '{ role: string; content: any; toolName: any; toolArgs: any; status: string; }' is not assignable to type 'Message'.
          Types of property 'role' are incompatible.
            Type 'string' is not assignable to type '"user" | "assistant" | "system"'.
src/ui.tsx(95,54): error TS2339: Property 'status' does not exist on type '{ index: number; role: "user" | "assistant" | "system"; content: string; timestamp?: Date; tools?: any[]; }'.
src/ui.tsx(108,51): error TS2345: Argument of type '{ role: string; content: any; toolName: any; toolArgs: any; status: string; }' is not assignable to parameter of type 'Message'.
  Types of property 'role' are incompatible.
    Type 'string' is not assignable to type '"user" | "assistant" | "system"'.
src/ui.tsx(140,20): error TS2345: Argument of type 'ChannelStream' is not assignable to parameter of type 'SetStateAction<string | null>'.
src/ui.tsx(163,61): error TS2339: Property 'status' does not exist on type '{ index: number; role: "user" | "assistant" | "system"; content: string; timestamp?: Date; tools?: any[]; }'.
src/ui.tsx(182,63): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/ui.tsx(194,29): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/ui.tsx(195,26): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/ui.tsx(204,70): error TS2339: Property 'status' does not exist on type '{ index: number; role: "user" | "assistant" | "system"; content: string; timestamp?: Date; tools?: any[]; }'.
src/ui.tsx(234,68): error TS2339: Property 'status' does not exist on type '{ index: number; role: "user" | "assistant" | "system"; content: string; timestamp?: Date; tools?: any[]; }'.
src/ui.tsx(266,60): error TS18046: 'parseError' is of type 'unknown'.
src/ui.tsx(280,35): error TS18046: 'error' is of type 'unknown'.
src/ui.tsx(293,42): error TS7006: Parameter 'messageText' implicitly has an 'any' type.
src/ui.tsx(306,21): error TS2339: Property 'sendMessage' does not exist on type 'string'.
src/ui.tsx(312,54): error TS18046: 'error' is of type 'unknown'.
src/ui.tsx(318,37): error TS7006: Parameter 'content' implicitly has an 'any' type.
src/ui.tsx(340,26): error TS2345: Argument of type '(prev: ToolDisplayMode) => string | undefined' is not assignable to parameter of type 'SetStateAction<ToolDisplayMode>'.
  Type '(prev: ToolDisplayMode) => string | undefined' is not assignable to type '(prevState: ToolDisplayMode) => ToolDisplayMode'.
    Type 'string | undefined' is not assignable to type 'ToolDisplayMode'.
      Type 'undefined' is not assignable to type 'ToolDisplayMode'.
src/ui.tsx(356,9): error TS2554: Expected 1 arguments, but got 0.
src/ui.tsx(373,19): error TS2339: Property 'close' does not exist on type 'string'.
src/ui.tsx(416,13): error TS2322: Type 'InputMode' is not assignable to type '"insert" | "command"'.
  Type '"normal"' is not assignable to type '"insert" | "command"'.
src/ui.tsx(417,13): error TS2322: Type 'Dispatch<SetStateAction<InputMode>>' is not assignable to type '(mode: "insert" | "command") => void'.
  Types of parameters 'value' and 'mode' are incompatible.
    Type '"insert" | "command"' is not assignable to type 'SetStateAction<InputMode>'.
      Type '"command"' is not assignable to type 'SetStateAction<InputMode>'.
src/ui.tsx(467,26): error TS2339: Property 'status' does not exist on type 'Message'.
src/ui.tsx(469,7): error TS2367: This comparison appears to be unintentional because the types '"user" | "assistant" | "system"' and '"tool"' have no overlap.
src/ui.tsx(508,26): error TS2339: Property 'toolArgs' does not exist on type 'Message'.
src/ui.tsx(508,45): error TS2339: Property 'toolArgs' does not exist on type 'Message'.
src/ui.tsx(512,20): error TS2339: Property 'toolName' does not exist on type 'Message'.
src/ui.tsx(536,7): error TS7034: Variable 'app' implicitly has type 'any' in some locations where its type cannot be determined.
src/ui.tsx(547,9): error TS7005: Variable 'app' implicitly has an 'any' type.
src/ui.tsx(559,8): error TS2375: Type '{ theaterClient: TheaterClient; actorId: string; config: ChatConfig; initialMessage: string | undefined; }' is not assignable to type 'ChatAppProps' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'initialMessage' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
      Type 'undefined' is not assignable to type 'string'.
