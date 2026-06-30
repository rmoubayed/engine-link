import * as fs from 'fs';
import * as path from 'path';
import type { UEProject } from '../types';

/**
 * Generate .cursor/rules/*.mdc files for UE-aware AI assistance.
 */
export async function generateCursorRules(project: UEProject): Promise<void> {
  const rulesDir = path.join(project.projectRoot, '.cursor', 'rules');
  await fs.promises.mkdir(rulesDir, { recursive: true });

  const rules = getRules();

  for (const rule of rules) {
    const filePath = path.join(rulesDir, rule.filename);
    // Only write if file doesn't exist (don't overwrite user customizations)
    try {
      await fs.promises.access(filePath);
    } catch {
      await fs.promises.writeFile(filePath, rule.content, 'utf-8');
    }
  }
}

interface RuleFile {
  filename: string;
  content: string;
}

function getRules(): RuleFile[] {
  return [
    {
      filename: 'unreal-conventions.mdc',
      content: `---
description: Unreal Engine C++ naming conventions and coding style
globs: ["*.h", "*.cpp", "*.inl"]
---

# Unreal Engine Naming Conventions

## Class Prefixes
- \`U\` prefix: Classes deriving from UObject (e.g., \`UActorComponent\`, \`UUserWidget\`)
- \`A\` prefix: Classes deriving from AActor (e.g., \`ACharacter\`, \`APlayerController\`)
- \`F\` prefix: Structs and non-UObject classes (e.g., \`FVector\`, \`FString\`, \`FName\`)
- \`E\` prefix: Enums (e.g., \`ECollisionChannel\`, \`EMovementMode\`)
- \`I\` prefix: Interfaces (e.g., \`IInteractable\`)
- \`T\` prefix: Templates (e.g., \`TArray\`, \`TMap\`, \`TSubclassOf\`)

## Coding Style
- Use PascalCase for all function names, variables, and types
- Boolean variables start with \`b\` (e.g., \`bIsActive\`, \`bCanJump\`)
- Use \`int32\`, \`uint8\`, \`float\` instead of \`int\`, \`unsigned char\`, etc.
- Use \`FString\` instead of \`std::string\`
- Use \`TArray\` instead of \`std::vector\`
- Use \`TMap\` instead of \`std::unordered_map\`
- Use \`MakeShared\`/\`TSharedPtr\` instead of \`std::shared_ptr\`
- Include the matching header first, then Engine headers, then project headers
- Use \`#pragma once\` instead of include guards
- Always use \`TEXT()\` macro for string literals passed to UE APIs
`,
    },
    {
      filename: 'unreal-macros.mdc',
      content: `---
description: Unreal Engine reflection macros (UCLASS, UPROPERTY, UFUNCTION) usage guide
globs: ["*.h"]
---

# UE Reflection Macros

## UCLASS()
Declares a class to the UE reflection system. Must appear before the class declaration.
\`\`\`cpp
UCLASS(BlueprintType, Blueprintable)
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()
public:
    AMyActor();
};
\`\`\`
Common specifiers: \`BlueprintType\`, \`Blueprintable\`, \`Abstract\`, \`NotBlueprintable\`, \`ClassGroup\`, \`meta=(DisplayName="...")\`

## UPROPERTY()
Exposes a property to the reflection system. Must appear before the member variable.
\`\`\`cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
float Health = 100.0f;
\`\`\`
Common specifiers: \`EditAnywhere\`, \`VisibleAnywhere\`, \`BlueprintReadOnly\`, \`BlueprintReadWrite\`, \`Category\`, \`meta=(ClampMin, ClampMax)\`, \`Replicated\`, \`ReplicatedUsing\`

## UFUNCTION()
Exposes a function to the reflection system.
\`\`\`cpp
UFUNCTION(BlueprintCallable, Category = "Combat")
void TakeDamage(float DamageAmount);

UFUNCTION(BlueprintImplementableEvent)
void OnDeath();
\`\`\`
Common specifiers: \`BlueprintCallable\`, \`BlueprintPure\`, \`BlueprintImplementableEvent\`, \`BlueprintNativeEvent\`, \`Server\`, \`Client\`, \`NetMulticast\`, \`Reliable\`, \`Unreliable\`

## USTRUCT()
\`\`\`cpp
USTRUCT(BlueprintType)
struct FMyStruct
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere)
    float Value;
};
\`\`\`

## UENUM()
\`\`\`cpp
UENUM(BlueprintType)
enum class EMyEnum : uint8
{
    None,
    Option1,
    Option2
};
\`\`\`

## GENERATED_BODY()
Must be the first line inside every UCLASS/USTRUCT. Do not add anything before it.
`,
    },
    {
      filename: 'unreal-build-system.mdc',
      content: `---
description: Unreal Engine build system (.Build.cs, .Target.cs, modules, plugins)
globs: ["*.Build.cs", "*.Target.cs", "*.uproject", "*.uplugin"]
---

# UE Build System

## Module Structure
Each module has: \`ModuleName.Build.cs\`, \`Public/\`, \`Private/\`, and optionally \`Classes/\`.

### .Build.cs
Defines module dependencies and build rules:
\`\`\`csharp
public class MyModule : ModuleRules
{
    public MyModule(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "InputCore"
        });

        PrivateDependencyModuleNames.AddRange(new string[] {
            "Slate", "SlateCore"
        });
    }
}
\`\`\`

### .Target.cs
Defines build target configuration:
\`\`\`csharp
public class MyProjectTarget : TargetRules
{
    public MyProjectTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MyProject");
    }
}
\`\`\`

## Adding Dependencies
- \`PublicDependencyModuleNames\`: Other modules that depend on YOUR module also get these
- \`PrivateDependencyModuleNames\`: Only YOUR module gets these dependencies
- Use Private when possible to reduce compile times

## Plugin Structure
A plugin has a \`.uplugin\` descriptor and one or more modules in \`Source/\`.
`,
    },
    {
      filename: 'unreal-live-coding.mdc',
      content: `---
description: Unreal Engine Live Coding limitations and best practices
globs: ["*.h", "*.cpp"]
---

# Live Coding Limitations

Live Coding (Ctrl+Alt+F11) patches binaries at runtime. These operations are NOT supported during Live Coding:

## Cannot Do
- Add or remove UPROPERTY members
- Add or remove UFUNCTION methods
- Change the signature (return type, name, parameters) of a UFUNCTION
- Add or remove UCLASS/USTRUCT/UENUM declarations
- Change class inheritance hierarchy
- Modify constructors of UObject-derived classes

## Can Do
- Modify function body logic
- Change local variables
- Modify non-reflected (non-UPROPERTY) member variables
- Add/modify non-reflected helper functions
- Change constants and literals

## Best Practice
If you need to add/remove reflected members, do a full Build instead of Live Coding.
`,
    },
    {
      filename: 'unreal-patterns.mdc',
      content: `---
description: Common Unreal Engine patterns (delegates, timers, subsystems, etc.)
globs: ["*.h", "*.cpp"]
---

# Common UE Patterns

## Delegates
\`\`\`cpp
// Declaration (in header)
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

// Usage (as UPROPERTY)
UPROPERTY(BlueprintAssignable)
FOnHealthChanged OnHealthChanged;

// Broadcasting
OnHealthChanged.Broadcast(CurrentHealth);
\`\`\`

## Timers
\`\`\`cpp
GetWorldTimerManager().SetTimer(TimerHandle, this, &AMyActor::DoSomething, 2.0f, false);
GetWorldTimerManager().ClearTimer(TimerHandle);
\`\`\`

## Subsystems
\`\`\`cpp
UMySubsystem* Sub = GetGameInstance()->GetSubsystem<UMySubsystem>();
UMyLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UMyLocalPlayerSubsystem>(LocalPlayer);
\`\`\`

## Gameplay Tags
\`\`\`cpp
FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName("Ability.Attack.Melee"));
\`\`\`

## Enhanced Input
\`\`\`cpp
// In SetupPlayerInputComponent:
UEnhancedInputComponent* EnhancedInput = CastChecked<UEnhancedInputComponent>(InputComponent);
EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyCharacter::Move);
\`\`\`

## Logging
\`\`\`cpp
// Declare in header:
DECLARE_LOG_CATEGORY_EXTERN(LogMyGame, Log, All);
// Define in cpp:
DEFINE_LOG_CATEGORY(LogMyGame);
// Usage:
UE_LOG(LogMyGame, Warning, TEXT("Player health: %f"), Health);
\`\`\`

## Spawning Actors
\`\`\`cpp
FActorSpawnParameters SpawnParams;
SpawnParams.Owner = this;
AMyActor* Actor = GetWorld()->SpawnActor<AMyActor>(ActorClass, SpawnLocation, SpawnRotation, SpawnParams);
\`\`\`
`,
    },
  ];
}
