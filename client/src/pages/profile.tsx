import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Mail, Upload, Calendar, Lock, X } from "lucide-react";
import { Link } from "wouter";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const profileSchema = z.object({
    fullName: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    dateOfBirth: z.string().optional().or(z.literal("")),
    profilePicture: z.string().optional().or(z.literal("")),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function Profile() {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const initializedRef = useRef(false);

    // Initialize user directly from localStorage to avoid loading state
    const [user, setUser] = useState<any>(() => {
        const userStr = localStorage.getItem("user");
        return userStr ? JSON.parse(userStr) : null;
    });

    const [previewImage, setPreviewImage] = useState<string>("");

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            fullName: "",
            email: "",
            dateOfBirth: "",
            profilePicture: "",
        },
    });

    const passwordForm = useForm<ChangePasswordFormValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const onProfileSubmit = async (data: ProfileFormValues) => {
        if (!user) {
            toast({ variant: "destructive", title: "Error", description: "User not found. Please log in." });
            return;
        }
        try {
            const res = await fetch("/api/user", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: user.username,
                    ...data,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to update profile");
            }

            const updatedUser = await res.json();
            localStorage.setItem("user", JSON.stringify(updatedUser.user));
            setUser(updatedUser.user);

            toast({
                title: "Success",
                description: "Profile updated successfully",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update profile",
            });
        }
    };

    const onPasswordSubmit = async (data: ChangePasswordFormValues) => {
        if (!user) {
            toast({ variant: "destructive", title: "Error", description: "User not found. Please log in." });
            return;
        }
        try {
            const res = await fetch("/api/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: user.username,
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update password");
            }

            toast({
                title: "Success",
                description: "Password updated successfully",
            });
            passwordForm.reset();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Something went wrong",
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Please upload an image file",
            });
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: `Image must be less than 5 MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
            });
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            setPreviewImage(base64String);
            form.setValue("profilePicture", base64String);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setPreviewImage("");
        form.setValue("profilePicture", "");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        if (user && !initializedRef.current) {
            initializedRef.current = true;
            const profilePicture = user.profilePicture || "";
            setPreviewImage(profilePicture);
            form.reset({
                fullName: user.fullName || "",
                email: user.email || "",
                dateOfBirth: user.dateOfBirth || "",
                profilePicture,
            });
        }
    }, []);

    // if (!user) {
    //     return (
    //         <div className="flex items-center justify-center min-h-screen">
    //             <p className="text-muted-foreground">Loading profile...</p>
    //         </div>
    //     );
    // }

    return (
        <div className="container max-w-4xl py-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                    <p className="text-muted-foreground">Manage your account settings and preferences.</p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_300px]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="fullName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input placeholder="John Doe" className="pl-8" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input placeholder="john@example.com" className="pl-8" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="dateOfBirth"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date of Birth</FormLabel>
                                                    <FormControl>
                                                        <div className="relative cursor-pointer">
                                                            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                            <Input type="date" className="pl-8 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="profilePicture"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Profile Picture</FormLabel>
                                                <FormControl>
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                ref={fileInputRef}
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleFileUpload}
                                                                className="hidden"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="w-full justify-start"
                                                            >
                                                                <Upload className="h-4 w-4 mr-2" />
                                                                Choose Image
                                                            </Button>
                                                        </div>
                                                        {previewImage && (
                                                            <div className="relative w-32 h-32 mx-auto">
                                                                <img
                                                                    src={previewImage}
                                                                    alt="Preview"
                                                                    className="w-full h-full object-cover rounded-lg"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={removeImage}
                                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </FormControl>
                                                <FormDescription>
                                                    Upload an image file. Max size: 5 MB
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex justify-end">
                                        <Button type="submit" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Update your password to keep your account secure.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                                    <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Current Password</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Lock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input type="password" placeholder="••••••" className="pl-8" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={passwordForm.control}
                                            name="newPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>New Password</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Lock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input type="password" placeholder="••••••" className="pl-8" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={passwordForm.control}
                                            name="confirmPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Confirm Password</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Lock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input type="password" placeholder="••••••" className="pl-8" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                            {passwordForm.formState.isSubmitting ? "Updating..." : "Update Password"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Picture</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            {previewImage ? (
                                <div className="relative w-32 h-32">
                                    <img
                                        src={previewImage}
                                        alt="Profile"
                                        className="w-full h-full object-cover rounded-full border-4 border-muted"
                                    />
                                </div>
                            ) : (
                                <Avatar className="h-32 w-32">
                                    <AvatarFallback className="text-2xl">
                                        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : (user?.username?.charAt(0).toUpperCase() || "U")}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                            <div className="text-center space-y-1">
                                <p className="font-medium">{user?.fullName || user?.username}</p>
                                <p className="text-sm text-muted-foreground">{user?.email || "No email set"}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
