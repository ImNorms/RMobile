// ProfileScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  useWindowDimensions,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "./firebaseConfig";
import { updateProfile, onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  getDocs, 
  where, 
  writeBatch 
} from "firebase/firestore";

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { width } = useWindowDimensions();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const storage = getStorage();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // -----------------------------
  // Function to Update User Name in All Comments
  // -----------------------------
  const updateUserNameInAllComments = async (userId, newName) => {
    if (!userId || !newName) return;
    
    try {
      console.log(`🔄 Updating username for ${userId} to ${newName} in all comments...`);
      
      // Get all posts
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedCommentsCount = 0;

      // Loop through all posts
      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        // Get all comments for this post by this user
        const commentsQuery = query(
          collection(db, "posts", postId, "comments"),
          where("userId", "==", userId)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        
        // Update each comment with the new name
        commentsSnapshot.forEach((commentDoc) => {
          const commentRef = doc(db, "posts", postId, "comments", commentDoc.id);
          batch.update(commentRef, {
            authorName: newName,
            userName: newName,
            user: newName
          });
          updatedCommentsCount++;
        });
      }

      // Commit all updates in a single batch
      if (updatedCommentsCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully updated ${updatedCommentsCount} comments with new username: ${newName}`);
        
        // Also update reacts with the new author name
        await updateUserNameInAllReacts(userId, newName);
        return true;
      } else {
        console.log("ℹ️ No comments found to update for user:", userId);
        return true; // No comments to update is still successful
      }
    } catch (error) {
      console.error("❌ Error updating username in comments:", error);
      return false;
    }
  };

  // Update User Name in All Reacts
  const updateUserNameInAllReacts = async (userId, newName) => {
    if (!userId || !newName) return;
    
    try {
      console.log(`🔄 Updating username for ${userId} to ${newName} in all reacts...`);
      
      // Get all posts
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedReactsCount = 0;

      // Loop through all posts
      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        // Get all reacts for this post by this user
        const reactsQuery = query(
          collection(db, "posts", postId, "reacts"),
          where("userId", "==", userId)
        );
        const reactsSnapshot = await getDocs(reactsQuery);
        
        // Update each react with the new author name
        reactsSnapshot.forEach((reactDoc) => {
          const reactRef = doc(db, "posts", postId, "reacts", reactDoc.id);
          batch.update(reactRef, {
            authorName: newName
          });
          updatedReactsCount++;
        });
      }

      // Commit all updates in a single batch
      if (updatedReactsCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully updated ${updatedReactsCount} reacts with new username: ${newName}`);
      } else {
        console.log("ℹ️ No reacts found to update for user:", userId);
      }
    } catch (error) {
      console.error("❌ Error updating username in reacts:", error);
    }
  };

  // Fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, "members", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUser({
              uid: currentUser.uid,
              name: userData.name || currentUser.displayName || "No name",
              email: userData.email || currentUser.email,
              photoURL: userData.photoURL || currentUser.photoURL,
              address: userData.address || "N/A",
              civilStatus: userData.civilStatus || "N/A",
              contact: userData.contact || "N/A",
              dob: userData.dob || "N/A",
              firstname: userData.firstname || "N/A",
              middlename: userData.middlename || "N/A",
              surname: userData.surname || "N/A",
              role: userData.role || "N/A",
              status: userData.status || "N/A",
            });
          } else {
            setUser({
              uid: currentUser.uid,
              name: currentUser.displayName || "No name",
              email: currentUser.email,
              photoURL: currentUser.photoURL,
            });
          }
        } catch (error) {
          console.error("❌ Error fetching user data:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Update name - NOW WITH COMMENT UPDATES
  const handleSaveName = async () => {
    if (!auth.currentUser) return;
    
    try {
      // Show loading
      setUploading(true);

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, { displayName: newName });
      
      // Update Firestore user document
      const userRef = doc(db, "members", auth.currentUser.uid);
      await updateDoc(userRef, { name: newName });

      // Update all past comments and reacts with new name
      const updateSuccess = await updateUserNameInAllComments(auth.currentUser.uid, newName);

      // Update local state
      setUser((prev) => ({ ...prev, name: newName }));
      setModalVisible(false);
      setNewName("");
      
      if (updateSuccess) {
        Alert.alert("✅ Success", "Name updated successfully! All your past comments now show your new name.");
      } else {
        Alert.alert("⚠️ Partial Success", "Name updated, but there was an issue updating some past comments.");
      }
    } catch (err) {
      console.error("❌ Error updating name:", err);
      Alert.alert("❌ Error", "Failed to update name. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Denied", "Allow access to photos to update your picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const selectedImage = result.assets[0].uri;
        setUser((prev) => ({ ...prev, photoURL: selectedImage }));
        setUploading(true);

        const response = await fetch(selectedImage);
        const blob = await response.blob();

        const currentUser = auth.currentUser;

        if (!currentUser) {
          Alert.alert("Error", "You must be logged in to upload a photo.");
          setUploading(false);
          return;
        }

        // Upload with timestamp
        const timestamp = Date.now();
        const uploadPath = `profilePhotos/${currentUser.uid}/profile_${timestamp}.jpg`;
        const fileRef = ref(storage, uploadPath);
        
        // Upload the file
        await uploadBytes(fileRef, blob);

        // Get download URL
        let downloadURL;
        try {
          downloadURL = await getDownloadURL(fileRef);
        } catch (downloadError) {
          // If we can't get download URL, use fallback
          downloadURL = `https://firebasestorage.googleapis.com/v0/b/hoa-appp.firebasestorage.app/o/${encodeURIComponent(uploadPath)}?alt=media`;
        }

        // Update Firebase Auth profile
        await updateProfile(currentUser, { photoURL: downloadURL });
        
        // Update Firestore
        const userRef = doc(db, "members", currentUser.uid);
        await updateDoc(userRef, { 
          photoURL: downloadURL,
          name: currentUser.displayName || user?.name 
        });

        setUser((prev) => ({ ...prev, photoURL: downloadURL }));
        Alert.alert("✅ Success", "Profile photo updated successfully!");
      }
    } catch (error) {
      if (error.code === 'storage/unauthorized') {
        Alert.alert("Upload Error", "Storage permissions issue. Please contact support.");
      } else {
        Alert.alert("Upload Error", "Failed to upload profile photo. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00695C" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerAccent} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.profileCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                {user?.photoURL ? (
                  <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {user?.name ? user.name[0].toUpperCase() : "?"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user?.role || "Member"}</Text>
              </View>
            </View>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Ionicons name="person-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>
                    {user?.firstname} {user?.middlename} {user?.surname}
                  </Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="call-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Contact</Text>
                  <Text style={styles.infoValue}>{user?.contact}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="calendar-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Date of Birth</Text>
                  <Text style={styles.infoValue}>{user?.dob}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="heart-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Civil Status</Text>
                  <Text style={styles.infoValue}>{user?.civilStatus}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="business-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Role</Text>
                  <Text style={styles.infoValue}>{user?.role}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="flag-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={styles.infoValue}>{user?.status}</Text>
                </View>
              </View>

              <View style={[styles.infoCard, styles.fullWidth]}>
                <Ionicons name="location-outline" size={20} color="#00695C" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{user?.address}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              { opacity: fadeAnim, transform: [{ scale: fadeAnim }] },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.editPhotoSection}>
              <TouchableOpacity onPress={handlePickImage}>
                {user?.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.editAvatar}
                  />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarText}>
                      {user?.name ? user.name[0].toUpperCase() : "?"}
                    </Text>
                  </View>
                )}
                {uploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.changePhotoText}>Tap to change photo</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter your new name"
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveName}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#00695C",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: "relative",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  headerAccent: {
    position: "absolute",
    bottom: -10,
    left: "50%",
    marginLeft: -10,
    width: 20,
    height: 20,
    backgroundColor: "#00695C",
    transform: [{ rotate: "45deg" }],
  },
  scrollContent: { padding: 20, paddingBottom: 100 },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  profileHeader: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  avatarContainer: { position: "relative", marginRight: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#00695C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, color: "#fff", fontWeight: "600" },
  profileInfo: { flex: 1 },
  name: { fontSize: 24, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  email: { fontSize: 16, color: "#64748b", marginBottom: 8 },
  roleBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  roleText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  infoGrid: { gap: 12, marginTop: 12 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#00695C",
  },
  fullWidth: { width: "100%" },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  infoValue: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  editButton: {
    flexDirection: "row",
    backgroundColor: "#00695C",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingBottom: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  editPhotoSection: { alignItems: "center", marginTop: 20 },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#e2e8f0",
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#00695C",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarText: { fontSize: 36, color: "#fff", fontWeight: "700" },
  changePhotoText: { marginTop: 8, fontSize: 14, color: "#64748b", fontWeight: "500" },
  uploadOverlay: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    margin: 20,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    color: "#1e293b",
  },
  modalButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: "#f1f5f9" },
  saveButton: { backgroundColor: "#00695C" },
  cancelButtonText: { color: "#64748b", fontSize: 16, fontWeight: "600" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});