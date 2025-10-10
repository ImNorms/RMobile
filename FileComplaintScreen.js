// FileComplaintScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Linking,
} from "react-native";
import { getAuth } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

export default function FileComplaintScreen({ navigation }) {
  const [name, setName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [address, setAddress] = useState("");
  const [complaint, setComplaint] = useState("");

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const auth = getAuth();
  const storage = getStorage();

  // Helper functions for file preview
  const getDocumentIcon = (fileName) => {
    if (!fileName) return 'document-outline';
    const extension = fileName.toLowerCase();
    
    if (extension.includes('.pdf')) return 'document-text-outline';
    if (extension.includes('.doc') || extension.includes('.docx')) return 'document-outline';
    if (extension.includes('.xls') || extension.includes('.xlsx')) return 'grid-outline';
    if (extension.includes('.ppt') || extension.includes('.pptx')) return 'easel-outline';
    if (extension.includes('.txt')) return 'document-text-outline';
    if (extension.includes('.zip') || extension.includes('.rar')) return 'archive-outline';
    return 'document-outline';
  };

  const getFileType = (fileName) => {
    if (!fileName) return 'Unknown';
    const extension = fileName.split('.').pop()?.toUpperCase();
    return extension || 'Unknown';
  };

  const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to view image in full screen
  const viewImage = (imageUrl, fileName) => {
    setSelectedImage({ url: imageUrl, name: fileName });
    setImageModalVisible(true);
  };

  // Function to open documents
  const openDocument = async (fileUrl, fileName) => {
    try {
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert(
          "Cannot Open File",
          `Unable to open ${fileName}. The file might not be supported on this device.`
        );
      }
    } catch (error) {
      console.error("Error opening document:", error);
      Alert.alert("Error", "Failed to open the document");
    }
  };

  const getFileNameFromUri = (uri) => {
    try {
      const lastSlash = uri.lastIndexOf("/");
      const baseName = lastSlash >= 0
        ? decodeURIComponent(uri.substring(lastSlash + 1))
        : `file_${Date.now()}`;
      
      // Add timestamp to ensure uniqueness
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      
      // If file has extension, preserve it
      const dotIndex = baseName.lastIndexOf('.');
      if (dotIndex > 0) {
        const nameWithoutExt = baseName.substring(0, dotIndex);
        const extension = baseName.substring(dotIndex);
        return `${nameWithoutExt}_${timestamp}_${randomId}${extension}`;
      }
      
      return `${baseName}_${timestamp}_${randomId}`;
    } catch {
      return `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
  };

  const uploadFile = async (uri, fileName = null) => {
    if (!auth.currentUser) throw new Error("User not logged in");
    const userId = auth.currentUser.uid;

    const finalFileName = fileName || getFileNameFromUri(uri);
    const storageRef = ref(storage, `complaints/${userId}/${finalFileName}`);

    try {
      // Fetch the file and convert to blob
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Validate file size (limit to 10MB)
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Please select a file smaller than 10MB.');
      }
      
      // Add metadata to help with CORS and file handling
      const metadata = {
        contentType: blob.type || 'application/octet-stream',
        customMetadata: {
          'uploaded-by': userId,
          'upload-time': new Date().toISOString(),
        }
      };

      // Upload the blob
      const uploadResult = await uploadBytes(storageRef, blob, metadata);
      
      // Get download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      return { 
        url: downloadUrl, 
        name: finalFileName,
        photoURL: downloadUrl,  // ✅ new field
        type: blob.type || 'unknown',
        size: blob.size || 0
      };
    } catch (error) {
      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('Upload permission denied. Please check your authentication.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload was canceled.');
      } else if (error.code === 'storage/quota-exceeded') {
        throw new Error('Storage quota exceeded.');
      } else if (error.code === 'storage/unauthenticated') {
        throw new Error('User not authenticated. Please log in again.');
      } else {
        throw new Error(`Upload failed: ${error.message}`);
      }
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need access to your photo library to attach images."
        );
        return;
      }

      // Launch image picker with newer syntax to avoid deprecation warning
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error("No image URI returned");

      setUploading(true);
      
      // Create a proper filename for images
      const fileName = `image_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
      const uploaded = await uploadFile(asset.uri, fileName);
      
      setAttachments((prev) => [...prev, uploaded]);
      
      Alert.alert("Success", "Image attached successfully!");
      
    } catch (e) {
      console.error("pickImage error:", e);
      Alert.alert(
        "Attach Image Failed",
        e.message || "Something went wrong while attaching the image."
      );
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0] ?? result;
      const uri = asset.uri;
      if (!uri) throw new Error("No document URI returned");

      setUploading(true);
      
      // Use the original filename if available, otherwise generate one
      const originalName = asset.name || asset.fileName || getFileNameFromUri(uri);
      const uploaded = await uploadFile(uri, originalName);
      
      setAttachments((prev) => [...prev, uploaded]);
      
      Alert.alert("Success", "Document attached successfully!");
      
    } catch (e) {
      console.error("pickDocument error:", e);
      Alert.alert(
        "Attach Document Failed",
        e.message || "Something went wrong while attaching the document."
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "You must be logged in to file a complaint.");
      return;
    }
    
    if (!name.trim() || !contactNo.trim() || !address.trim() || !complaint.trim()) {
      Alert.alert(
        "Missing info",
        "Please fill in your name, contact no, address, and complaint."
      );
      return;
    }

    try {
      setUploading(true);
   await addDoc(collection(db, "complaints"), {
  userId: user.uid,
  userEmail: user.email || '',
  name: name.trim(),
  contactNo: contactNo.trim(),
  address: address.trim(),
  complaint: complaint.trim(),
  attachments, // ✅ each attachment now has photoURL
  status: "new",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

      Alert.alert("Success", "Complaint submitted successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack()
        }
      ]);
      
      // Reset form
      setName("");
      setContactNo("");
      setAddress("");
      setComplaint("");
      setAttachments([]);
      
    } catch (e) {
      console.error("submit complaint error:", e);
      Alert.alert("Error", e.message || "Failed to submit complaint.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>File a Complaint</Text>

        <TextInput
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          editable={!uploading}
        />
        <TextInput
          placeholder="Contact No."
          value={contactNo}
          onChangeText={setContactNo}
          style={styles.input}
          keyboardType="phone-pad"
          editable={!uploading}
        />
        <TextInput
          placeholder="Address"
          value={address}
          onChangeText={setAddress}
          style={styles.input}
          editable={!uploading}
        />
        <TextInput
          placeholder="Enter your complaint"
          value={complaint}
          onChangeText={setComplaint}
          style={[styles.input, { height: 110 }]}
          multiline
          editable={!uploading}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.fileButton, uploading && styles.disabledButton]}
            onPress={pickImage}
            disabled={uploading}
          >
            <Ionicons name="camera" size={18} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.fileButtonText}>Attach Image</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.fileButton, uploading && styles.disabledButton]}
            onPress={pickDocument}
            disabled={uploading}
          >
            <Ionicons name="document" size={18} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.fileButtonText}>Attach Document</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#6c63ff" />
            <Text style={{ marginLeft: 8, color: "#666" }}>Processing file...</Text>
          </View>
        )}

        {attachments.length > 0 && (
          <View style={styles.attachList}>
            <Text style={styles.attachListTitle}>Attached files ({attachments.length}):</Text>
            {attachments.map((file, idx) => {
              const isImage = file.name && /\.(jpeg|jpg|png|gif|webp|bmp)$/i.test(file.name);
              
              return (
                <View key={`${file.url}-${idx}`} style={styles.attachmentItem}>
                  {isImage ? (
                    // Image Preview - Clickable
                    <TouchableOpacity 
                      style={styles.imagePreviewContainer}
                      onPress={() => viewImage(file.url, file.name)}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={{ uri: file.url }} 
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                      <View style={styles.imageInfo}>
                        <Text style={styles.attachItem} numberOfLines={1}>
                          📷 {file.name}
                        </Text>
                        {file.size && (
                          <Text style={styles.fileSize}>
                            {(file.size / 1024).toFixed(1)} KB
                          </Text>
                        )}
                        <Text style={styles.tapToView}>Tap to view full size</Text>
                      </View>
                      <View style={styles.buttonContainer}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation(); // Prevent image modal from opening
                            removeAttachment(idx);
                          }}
                          style={styles.removeButton}
                          disabled={uploading}
                        >
                          <Ionicons name="close-circle" size={24} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    // Document Preview - Clickable
                    <TouchableOpacity 
                      style={styles.documentPreviewContainer}
                      onPress={() => openDocument(file.url, file.name)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.documentIcon}>
                        <Ionicons 
                          name={getDocumentIcon(file.name)} 
                          size={32} 
                          color="#6c63ff" 
                        />
                      </View>
                      <View style={styles.documentInfo}>
                        <Text style={styles.attachItem} numberOfLines={2}>
                          📎 {file.name}
                        </Text>
                        {file.size && (
                          <Text style={styles.fileSize}>
                            {formatFileSize(file.size)}
                          </Text>
                        )}
                        <Text style={styles.fileType}>
                          {getFileType(file.name)}
                        </Text>
                        <Text style={styles.tapToView}>Tap to open</Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation(); // Prevent document from opening
                          removeAttachment(idx);
                        }}
                        style={styles.removeButton}
                        disabled={uploading}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Complaint</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Image Modal for Full Screen Viewing */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedImage?.name || 'Image'}
            </Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.imageModalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle" size={22} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons name="home" size={22} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.replace("Login")}
        >
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 100 }, // space for footer
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  fileButton: {
    backgroundColor: "#6c63ff",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  fileButtonText: { 
    color: "#fff", 
    textAlign: "center", 
    fontWeight: "600",
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  attachList: {
    marginBottom: 20,
    backgroundColor: "#f8f9ff",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  attachListTitle: { 
    fontWeight: "700", 
    marginBottom: 10,
    color: "#333",
    fontSize: 16,
  },
  attachmentItem: {
    marginBottom: 12,
  },
  imagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  imageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e4ff",
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d0d0",
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  attachItem: { 
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  fileType: {
    fontSize: 11,
    color: "#888",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  tapToView: {
    fontSize: 11,
    color: "#007AFF",
    fontStyle: "italic",
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: "column",
    alignItems: "center",
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
  },
  closeModalButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    padding: 8,
  },
  imageModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: { 
    backgroundColor: "#28a745", 
    padding: 16, 
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    alignItems: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
});