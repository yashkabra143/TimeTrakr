export interface User {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  profilePicture?: string | null;
}

export async function checkAuth(): Promise<User | null> {
  try {
    const response = await fetch("/api/me", {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
}
