import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, cn } from "@/lib/utils";

export function MemberAvatar({
  fullName,
  size = "default",
  showTooltip = true,
  className,
}: {
  fullName: string;
  size?: "sm" | "default";
  showTooltip?: boolean;
  className?: string;
}) {
  const avatar = (
    <Avatar className={cn(size === "sm" ? "h-6 w-6" : "h-8 w-8", className)}>
      <AvatarFallback className={size === "sm" ? "text-[10px]" : "text-xs"}>{initials(fullName)}</AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) return avatar;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent>{fullName}</TooltipContent>
    </Tooltip>
  );
}

export function MemberAvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((name) => (
        <MemberAvatar key={name} fullName={name} size="sm" className="border-2 border-background" />
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
