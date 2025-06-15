src/MultiLineInput.tsx(1,10): error TS2300: Duplicate identifier 'useCallback'.
src/MultiLineInput.tsx(2,10): error TS2300: Duplicate identifier 'useCallback'.
src/MultiLineInput.tsx(89,7): error TS2722: Cannot invoke an object which is possibly 'undefined'.
src/theater.ts(250,26): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/ui.tsx(171,63): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/ui.tsx(332,26): error TS2345: Argument of type '(prev: ToolDisplayMode) => ToolDisplayMode | undefined' is not assignable to parameter of type 'SetStateAction<ToolDisplayMode>'.
  Type '(prev: ToolDisplayMode) => ToolDisplayMode | undefined' is not assignable to type '(prevState: ToolDisplayMode) => ToolDisplayMode'.
    Type 'ToolDisplayMode | undefined' is not assignable to type 'ToolDisplayMode'.
      Type 'undefined' is not assignable to type 'ToolDisplayMode'.
src/ui.tsx(551,8): error TS2375: Type '{ theaterClient: TheaterClient; actorId: string; config: ChatConfig; initialMessage: string | undefined; }' is not assignable to type 'ChatAppProps' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'initialMessage' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
      Type 'undefined' is not assignable to type 'string'.
