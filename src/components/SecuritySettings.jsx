import { UserProfile } from "@clerk/clerk-react";

export default function SecuritySettings() {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <UserProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: "100%" },
            cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "none", borderRadius: 12 },
            card: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "none" },
            headerTitle: { fontSize: 16, fontWeight: 700 },
            formButtonPrimary: { backgroundColor: "#E9622F", fontSize: 14 },
            badge: { backgroundColor: "#FEF2E8", color: "#E9622F" },
          },
          variables: {
            colorPrimary: "#E9622F",
          },
        }}
      >
        <UserProfile.Page label="security" />
        <UserProfile.Page label="account" />
      </UserProfile>
    </div>
  );
}