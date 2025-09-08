import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronDown, X, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

const MultiSelect = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ open, onOpenChange, children, ...props }, ref) => (
  <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <div ref={ref} {...props}>
      {children}
    </div>
  </PopoverPrimitive.Root>
))

const MultiSelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
))

const MultiSelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("", className)} {...props} />
))

interface MultiSelectTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  selectedItems?: Array<{id: string; label: string}>
  placeholder?: string
  onRemoveItem?: (id: string) => void
}

const MultiSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  MultiSelectTriggerProps
>(({ className, children, selectedItems = [], placeholder, onRemoveItem, ...props }, ref) => (
  <PopoverPrimitive.Trigger asChild>
    <button
      ref={ref}
      className={cn(
        "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap gap-1 flex-1">
        {selectedItems.length > 0 ? (
          selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="text-xs px-2 py-1 flex items-center gap-1"
            >
              {item.label}
              {onRemoveItem && (
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveItem(item.id)
                  }}
                />
              )}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </div>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  </PopoverPrimitive.Trigger>
))
MultiSelectTrigger.displayName = "MultiSelectTrigger"

interface MultiSelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  searchable?: boolean
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
}

const MultiSelectContent = React.forwardRef<
  HTMLDivElement,
  MultiSelectContentProps
>(({ className, children, searchable = false, searchPlaceholder = "Search...", onSearchChange, ...props }, ref) => {
  const [search, setSearch] = React.useState("")

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onSearchChange?.(value)
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        className={cn(
          "z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        sideOffset={4}
        {...props}
      >
        {searchable && (
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        )}
        <div className="p-1">
          {children}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})
MultiSelectContent.displayName = "MultiSelectContent"

const MultiSelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
MultiSelectLabel.displayName = "MultiSelectLabel"

interface MultiSelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean
  onSelect?: () => void
  value?: string
}

const MultiSelectItem = React.forwardRef<
  HTMLDivElement,
  MultiSelectItemProps
>(({ className, children, checked = false, onSelect, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      checked && "bg-accent/50",
      className
    )}
    onClick={onSelect}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      {checked && <Check className="h-4 w-4" />}
    </span>
    <div className="flex-1">{children}</div>
  </div>
))
MultiSelectItem.displayName = "MultiSelectItem"

const MultiSelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
MultiSelectSeparator.displayName = "MultiSelectSeparator"

export {
  MultiSelect,
  MultiSelectGroup,
  MultiSelectValue,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectLabel,
  MultiSelectItem,
  MultiSelectSeparator,
}