-- CapstoneX2 Clean Initialization Schema & Seed (UTF-8)
-- Generated from capx_db on 2026-11-17T22:58:35.080Z
-- Includes: All 21 table schemas, bcrypt-hashed Admin accounts, and Repository titles.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- --------------------------------------------------------
-- Table structure for `adviser_requests`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `adviser_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `adviser_id` int NOT NULL,
  `request_status` varchar(30) DEFAULT 'Pending',
  `request_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `adviser_feedback` text,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  KEY `adviser_id` (`adviser_id`),
  CONSTRAINT `adviser_requests_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `capstone_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `adviser_requests_ibfk_2` FOREIGN KEY (`adviser_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `adviser_settings`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `adviser_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `faculty_id` int NOT NULL,
  `group_capacity` int DEFAULT '0',
  `program_cater` varchar(20) DEFAULT 'Not Set',
  `year_level_cater` varchar(50) DEFAULT 'Not Set',
  `adviser_status` varchar(30) DEFAULT 'Not Configured',
  `catering_year` int DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `faculty_id` (`faculty_id`),
  CONSTRAINT `adviser_settings_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `announcements`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `announcement_code` varchar(30) NOT NULL,
  `created_by` int NOT NULL,
  `announcement_title` varchar(255) NOT NULL,
  `announcement_type` varchar(100) NOT NULL,
  `audience` varchar(100) NOT NULL,
  `target_program` varchar(50) DEFAULT NULL,
  `announcement_content` text NOT NULL,
  `announcement_status` varchar(50) DEFAULT 'Published',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `announcement_code` (`announcement_code`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `capstone_groups`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `capstone_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` varchar(20) NOT NULL,
  `group_name` varchar(255) NOT NULL,
  `project_title` varchar(255) DEFAULT NULL,
  `program` varchar(10) DEFAULT NULL,
  `project_manager_id` int NOT NULL,
  `adviser_id` int DEFAULT NULL,
  `progress` int DEFAULT '0',
  `stage` varchar(100) DEFAULT 'Stage 1',
  `status` varchar(50) DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_id` (`group_id`),
  KEY `project_manager_id` (`project_manager_id`),
  KEY `fk_group_adviser` (`adviser_id`),
  CONSTRAINT `capstone_groups_ibfk_1` FOREIGN KEY (`project_manager_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_group_adviser` FOREIGN KEY (`adviser_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `consultations`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `consultation_code` varchar(60) NOT NULL,
  `student_id` int NOT NULL,
  `group_id` int DEFAULT NULL,
  `assigned_faculty_id` int NOT NULL,
  `assigned_role` varchar(30) NOT NULL,
  `consultation_type` varchar(60) NOT NULL,
  `topic` varchar(255) DEFAULT NULL,
  `concern_message` text NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Pending',
  `scheduled_date` date DEFAULT NULL,
  `scheduled_start_time` time DEFAULT NULL,
  `scheduled_end_time` time DEFAULT NULL,
  `consultation_mode` varchar(40) DEFAULT NULL,
  `location_or_link` varchar(500) DEFAULT NULL,
  `schedule_notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `file_path` varchar(500) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `decline_reason` text,
  `declined_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `consultation_code` (`consultation_code`),
  KEY `idx_consultations_student` (`student_id`),
  KEY `idx_consultations_faculty` (`assigned_faculty_id`),
  KEY `idx_consultations_schedule` (`assigned_faculty_id`,`scheduled_date`,`scheduled_start_time`,`scheduled_end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `defense_panel_evaluations`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `defense_panel_evaluations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `panelist_id` int NOT NULL,
  `score` varchar(50) DEFAULT NULL,
  `panel_result` varchar(50) NOT NULL,
  `comments` text,
  `recommendations` text,
  `approved_title_id` varchar(50) DEFAULT NULL,
  `concept_evaluation_details` longtext,
  `evaluated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `outline_evaluation_details` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_schedule_panelist` (`schedule_id`,`panelist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `defense_schedule_panelists`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `defense_schedule_panelists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int NOT NULL,
  `panelist_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `schedule_id` (`schedule_id`),
  KEY `panelist_id` (`panelist_id`),
  CONSTRAINT `defense_schedule_panelists_ibfk_1` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `defense_schedule_panelists_ibfk_2` FOREIGN KEY (`panelist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `defense_schedules`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `defense_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_code` varchar(50) NOT NULL,
  `group_id` int NOT NULL,
  `panelist_id` int NOT NULL,
  `created_by` int NOT NULL,
  `room_name` varchar(100) NOT NULL,
  `defense_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `defense_type` varchar(100) DEFAULT 'Capstone Defense',
  `defense_status` varchar(50) DEFAULT 'Scheduled',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `score` varchar(50) DEFAULT NULL,
  `panel_result` varchar(50) DEFAULT 'Pending',
  `comments` text,
  `recommendations` text,
  `approved_title_id` varchar(50) DEFAULT NULL,
  `concept_evaluation_details` longtext,
  `outline_evaluation_details` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `schedule_code` (`schedule_code`),
  KEY `group_id` (`group_id`),
  KEY `panelist_id` (`panelist_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `defense_schedules_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `capstone_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `defense_schedules_ibfk_2` FOREIGN KEY (`panelist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `defense_schedules_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `document_submissions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `document_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `submission_message` text,
  `submission_status` varchar(50) DEFAULT 'Sent',
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `review_status` varchar(100) DEFAULT 'Pending Review',
  `review_comment` text,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `target_role` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  KEY `fk_document_reviewed_by` (`reviewed_by`),
  CONSTRAINT `document_submissions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `student_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_submissions_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_submissions_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `env_scan_student_signatures`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `env_scan_student_signatures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `student_user_id` varchar(50) NOT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `student_position` varchar(100) DEFAULT NULL,
  `signed_file_path` varchar(500) DEFAULT NULL,
  `signed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_doc_student` (`document_id`,`student_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `faculty_document_submissions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faculty_document_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `submission_message` text,
  `submission_status` varchar(100) DEFAULT 'Sent',
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `faculty_document_submissions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `faculty_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `faculty_document_submissions_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `faculty_document_submissions_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `faculty_documents`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faculty_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_code` varchar(50) NOT NULL,
  `uploaded_by` int NOT NULL,
  `document_title` varchar(255) NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_format` varchar(50) DEFAULT NULL,
  `document_status` varchar(100) DEFAULT 'Sent',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_code` (`document_code`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `faculty_documents_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `group_members`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `group_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `student_id` int NOT NULL,
  `member_position` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `capstone_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `group_members_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `messages`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` varchar(50) NOT NULL,
  `receiver_id` varchar(50) NOT NULL,
  `message_text` text,
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `repository`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `repository` (
  `id` int NOT NULL AUTO_INCREMENT,
  `program` varchar(50) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `abstract` text,
  `objectives` text,
  `research_problem` text,
  `methodology` text,
  `researchers` text,
  `adviser` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `year` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `student_documents`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `student_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_code` varchar(30) NOT NULL,
  `group_id` int NOT NULL,
  `uploaded_by` int NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `document_title` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_format` varchar(20) NOT NULL,
  `document_status` varchar(50) DEFAULT 'Uploaded',
  `is_sent` tinyint(1) DEFAULT '0',
  `sent_to_role` varchar(50) DEFAULT NULL,
  `sent_to_user_id` int DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `signed_file_path` varchar(500) DEFAULT NULL,
  `submission_count` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_code` (`document_code`),
  KEY `group_id` (`group_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `sent_to_user_id` (`sent_to_user_id`),
  CONSTRAINT `student_documents_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `capstone_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_documents_ibfk_3` FOREIGN KEY (`sent_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `student_hidden_updates`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `student_hidden_updates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `update_type` varchar(50) NOT NULL,
  `update_id` int NOT NULL,
  `hidden_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_hidden_update` (`student_id`,`update_type`,`update_id`),
  CONSTRAINT `student_hidden_updates_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `title_proposals`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `title_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `title_number` int NOT NULL,
  `proposed_title` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_by` int NOT NULL,
  `status` varchar(30) DEFAULT 'Pending Review',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `proposed_objectives` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_group_title_number` (`group_id`,`title_number`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `title_proposals_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `capstone_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `title_proposals_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `title_similarity_results`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `title_similarity_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` varchar(50) NOT NULL,
  `proposed_title_id` int NOT NULL,
  `matched_repository_id` int DEFAULT NULL,
  `similarity_percentage` int NOT NULL,
  `similarity_level` varchar(50) NOT NULL,
  `matching_sections` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `matched_group_name` varchar(255) DEFAULT NULL,
  `matched_approved_title` varchar(500) DEFAULT NULL,
  `matched_source_type` varchar(50) DEFAULT 'repository',
  `archived_match_details` longtext,
  `ongoing_match_details` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_proposal` (`proposed_title_id`),
  KEY `matched_repository_id` (`matched_repository_id`),
  CONSTRAINT `title_similarity_results_ibfk_1` FOREIGN KEY (`proposed_title_id`) REFERENCES `title_proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `title_similarity_results_ibfk_2` FOREIGN KEY (`matched_repository_id`) REFERENCES `repository` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `user_notifications`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `notification_title` varchar(255) NOT NULL,
  `notification_message` text NOT NULL,
  `notification_type` varchar(100) DEFAULT 'Defense Schedule',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(20) NOT NULL,
  `fullname` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('student','faculty','admin') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `position` varchar(100) DEFAULT NULL,
  `adviser_access` tinyint(1) DEFAULT '0',
  `panelist_access` tinyint(1) DEFAULT '0',
  `instructor_access` tinyint(1) DEFAULT '0',
  `program` varchar(100) DEFAULT NULL,
  `year_level` varchar(100) DEFAULT NULL,
  `student_position` varchar(100) DEFAULT NULL,
  `adviser_id` int DEFAULT NULL,
  `profile_image` varchar(500) DEFAULT NULL,
  `force_password_change` tinyint(1) DEFAULT '1',
  `enrolled_by_user_id` varchar(50) DEFAULT NULL,
  `digital_signature` varchar(500) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `student_status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `consultation_available` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Seed Admin accounts (3 bcrypt-hashed accounts)
-- --------------------------------------------------------
INSERT IGNORE INTO `users` (`id`, `user_id`, `fullname`, `password`, `role`, `created_at`, `position`, `adviser_access`, `panelist_access`, `instructor_access`, `program`, `year_level`, `student_position`, `adviser_id`, `profile_image`, `force_password_change`, `enrolled_by_user_id`, `digital_signature`, `email`, `student_status`, `consultation_available`) VALUES
(1, 'ADM2026-0001', 'Mark Van Buladaco', '$2b$10$z.JaRbLuBDnIT8lgfDTKJuvADhBibOuQBXGgd4YN/tZiHxKNM7x5W', 'admin', '2026-05-12 18:32:19', 'Dean', 1, 1, 1, 'Dean Office', NULL, NULL, NULL, NULL, 0, NULL, '/uploads/signatures/1791766445261-137114541.png', NULL, 'ACTIVE', 1),
(2, 'ADM2026-0002', 'Jovito P. Bolacoy Junior', '$2b$10$dIDpON.RH/kD6Nxt1gjjaOtv1OjviOVJsfsp.s2Ho2EUyABLVkwJG', 'admin', '2026-05-31 00:12:18', 'Program Chairperson IS', 1, 1, 1, 'Dean Office', NULL, NULL, NULL, NULL, 0, NULL, '/uploads/signatures/1791766761075-139585669.png', NULL, 'ACTIVE', 1),
(3, 'ADM2026-0003', 'Reban Cliff A. Fajardo', '$2b$10$Hb2D9LnEACArhirly9Fgee2kgNFV5RxRt0vLHhj7V/vDJl42ZYCCW', 'admin', '2026-05-31 00:12:18', 'Program Chairperson - BSIT', 1, 1, 1, 'BSIT', NULL, NULL, NULL, NULL, 0, NULL, '/uploads/signatures/1794675385993-919127340.png', NULL, 'ACTIVE', 1);

-- --------------------------------------------------------
-- Seed Repository titles (12 entries)
-- --------------------------------------------------------
INSERT IGNORE INTO `repository` (`id`, `program`, `title`, `abstract`, `objectives`, `research_problem`, `methodology`, `researchers`, `adviser`, `category`, `year`, `created_at`) VALUES
(9, 'IT', 'BrewSpot: A Geolocation-Enabled Web Directory and Crowd-Sourced Review Platform for Local Coffee Shops', 'Remote workers, students, and coffee enthusiasts frequently struggle to find local cafes that match specific needs such as reliable Wi-Fi, available power outlets, and quiet study environments. BrewSpot is a web-based discovery platform that connects users with nearby independent coffee shops using interactive mapping and crowd-sourced amenity tagging. The system allows users to filter cafes by distance, seating capacity, noise level, and menu pricing while enabling cafe owners to update operating hours and promotional offers. By combining spatial search with real-time user reviews, the platform enhances local business visibility and helps customers make informed choices.', '• General Objective: To develop a responsive web-based coffee shop finder and review platform that helps users locate nearby cafes based on specific amenities and real-time community feedback.\n• Specific Objectives:\n	• Integrate an interactive map API to display nearby coffee shops based on the user\'s current browser geolocation.\n	• Implement multi-criteria search filters for amenities including Wi-Fi speed, power outlet availability, and study-friendly ratings.\n	• Build a verified user review and photo upload module to maintain accurate, crowd-sourced cafe profiles.\n	• Provide a dedicated business portal for coffee shop owners to claim listings and manage menu updates.', '• Existing general map directories lack specialized filters for work-friendly cafe amenities like outlet availability and internet reliability.\n• Independent and newly opened local coffee shops struggle to gain online visibility compared to large commercial chains.\n• Users often waste time traveling to cafes only to find overcrowded spaces or outdated operating hours.', 'The development team adopted the Rapid Application Development (RAD) model to prioritize user interface prototyping and early feedback from local cafe-goers. System architecture was built using a modern JavaScript stack featuring Next.js for server-side rendering, Leaflet.js with OpenStreetMap for spatial mapping, and PostgreSQL for storing geospatial coordinates and user reviews. Functional testing and heuristic evaluation were conducted with local coffee shop owners and university students to validate search speed and mobile browser responsiveness.', 'Angel Mae M. Sardido, John Michael C. Evangelista, Jayson T. Benatero', 'Prof. Alex Santos', 'Web Application', '2024', '2026-11-11 20:32:17'),
(10, 'IS', 'InternMatch: A Web-Based Student Internship Placement and Skill-Matching Portal', 'Finding suitable host training establishments that align with a student\'s technical specialization often requires exhausting manual applications and cold emailing. InternMatch is a web-based internship placement and monitoring portal built to connect graduating computing students with verified partner companies. The system profiles student skills, academic tracks, and career interests to recommend relevant internship openings while allowing companies to post vacancies and review applicants online. Once hired, the platform transitions into an active deployment tracker for coordinators to monitor student onboarding and contract statuses.', '• General Objective: To build a web-based internship placement and monitoring portal that matches students with partner companies based on technical competencies and tracks deployment progress.\n• Specific Objectives:\n	• Develop a student portfolio builder that highlights programming languages, completed coursework, and preferred IT roles.\n	• Implement a skill-based filtering and recommendation module to connect applicants with matching company listings.\n	• Create a company recruiter dashboard to post internship slots, schedule interviews, and issue digital acceptance letters.\n	• Provide OJT coordinators with a real-time deployment tracker showing hired, pending, and unplaced students.', 'Research Problem\n\n• Graduating students struggle to locate partner companies that offer roles aligned with their specific IT or Information Systems tracks.\n• Partner companies receive unorganized resumes via email, making it difficult to screen candidates efficiently.\n• OJT coordinators lack a centralized dashboard to monitor which students have secured placements before the semester deadline.', 'The proponents utilized the Agile Kanban Methodology to continuously deploy features based on feedback from the university career placement office. The web application was built using Vue.js for the reactive frontend, Laravel (PHP) for RESTful API management, and MySQL for relational data storage. System effectiveness was validated through pilot testing with third-year students and partner HR representatives using usability questionnaires.', '', '', 'Web Development', '2023', '2026-11-11 21:19:03'),
(11, 'IS', 'ThesisFlow: A Collaborative Web-Based Capstone Project Tracker and Adviser Workload Balancer', 'Managing multiple undergraduate capstone teams across different faculty advisers frequently results in uneven advising workloads and missed manuscript deadlines. ThesisFlow is a web-based collaborative project management platform tailored for capstone research teams and faculty advisers. The system features milestone checklists, integrated document version control, and an automated adviser assignment tool that balances faculty loads based on domain expertise and current advisee counts. This platform keeps student groups accountable while giving coordinators clear oversight of department-wide research progress.', '• General Objective: To develop a web-based collaborative capstone tracker that streamlines team milestone monitoring and balances faculty advising workloads.\n• Specific Objectives:\n	• Implement an automated adviser matching algorithm based on faculty specialization tags and maximum advisee limits.\n	• Create a milestone-driven project board with automated deadline reminders for chapters one through five.\n	• Integrate an inline document review and commenting tool to track manuscript revisions between students and advisers.\n	• Build an administrative overview dashboard displaying group completion rates and bottlenecks per academic term.', '• Popular faculty members often become overloaded with too many capstone advisees, leading to delayed feedback and burnout.\n• Student teams frequently miss defense requirements due to scattered communication across different messaging apps.\n• Research coordinators lack real-time visibility into which capstone groups are falling behind schedule prior to final defense week.', 'The team adopted the Scrum Framework, organizing development into three-week sprints with regular reviews from capstone advisers. The web platform was constructed using Angular for the frontend interface, Django (Python) for backend logic, and PostgreSQL for transactional data integrity. Performance and user satisfaction were measured using black-box testing and ISO 25010 evaluation surveys conducted among capstone students and faculty.', '', '', 'Web Development', '', '2026-11-11 21:19:50'),
(12, 'IT', 'AgroSense: Smart Soil and Irrigation Monitoring System', 'Traditional farming often wastes water due to manual irrigation schedules. AgroSense uses soil moisture and temperature sensors connected to a microcontroller to automate watering. Farmers can monitor field conditions and control water pumps remotely through a mobile app.', '• To design and assemble an IoT hardware setup that reads real-time soil moisture and temperature.\n• To develop a mobile application for remote irrigation control and data visualization.\n• To evaluate the system\'s water-saving efficiency compared to manual watering methods.', '• \n	• Over-irrigation and under-irrigation reduce crop yields and waste water resources.\n	• Farmers lack real-time field data when away from their farms.\n	• Existing commercial smart-farming tools are too expensive for small-scale growers.', 'Rapid Application Development (RAD) is used to quickly build hardware prototypes and iterate on the mobile interface based on farmer feedback.', 'Canillo, Mendez, Magsanay', 'Rafael Dela Penia', 'Web Application', '2024', '2026-11-14 23:34:01'),
(13, 'IS', 'MedTrack: Hospital Inventory and Expiry Management System', 'Hospitals frequently struggle with expired medicines and sudden stockouts of critical supplies. MedTrack centralizes pharmaceutical inventory tracking, using automated alerts to flag low stock and nearing expiration dates. It helps procurement teams optimize supply orders based on historical usage data.', '• \n	• To centralize medicine inventory tracking across multiple hospital departments.\n	• To automate email and dashboard notifications for low-stock and near-expiry items.\n	• To generate monthly consumption reports to aid procurement decision-making.\n', '• Manual spreadsheet tracking leads to human error and untracked expired drugs.\n• Sudden stockouts of essential medicines delay patient treatment.\n• Hospital administrators lack accurate data to forecast seasonal supply demands.', 'Agile Scrum allows the development team to deliver core inventory modules in short sprints while adapting to pharmacy staff workflows.', '', '', '', '', '2026-11-14 23:34:41'),
(14, 'IT', 'SafeCommute: Real-Time Public Jeepney and Bus Tracker', 'Commuters often face long, uncertain wait times at public transit stops. SafeCommute equips public utility vehicles with GPS modules that transmit live location data to a cloud server. Commuters can view approaching vehicles, estimated arrival times, and seat availability on a mobile map.', '• \n	• To integrate GPS hardware transmitters into public utility vehicles for live tracking.\n	• To build a mobile app displaying real-time vehicle locations and estimated arrival times.\n	• To test the GPS accuracy and latency under varying urban traffic conditions.\n', '• Commuters experience unpredictable waiting times and crowded terminals.\n• Drivers lack visibility into passenger demand along specific route segments.\n• Transport operators have no centralized way to monitor fleet compliance with routes.', 'Prototyping Model helps validate GPS signal accuracy and map rendering early before deploying the app to commuters.', '', '', 'IoT', '', '2026-11-14 23:35:20'),
(15, 'IT', 'BizFlow: Automated Point-of-Sale and Financial Analytics for MSMEs', 'Micro, small, and medium enterprises (MSMEs) often rely on handwritten ledgers, making profit calculation difficult. BizFlow combines a point-of-sale (POS) terminal with automated bookkeeping and tax-ready financial reporting. Business owners gain clear insights into best-selling items and daily cash flow.', '• \n	• To develop an easy-to-use POS system tailored for small retail businesses.\n	• To automate daily sales aggregation, expense logging, and profit-loss reporting.\n	• To assess the usability and time-saving impact of the system on local shop owners.\n', '• Manual record-keeping causes frequent calculation errors and unrecorded transactions.\n• Small business owners struggle to track net profit due to mixed personal and business expenses.\n• Generating financial statements for loans or tax compliance is time-consuming.', 'Waterfall Model fits well since accounting formulas, POS workflows, and tax reporting rules are clearly defined upfront.', '', '', 'Web Application', '', '2026-11-14 23:36:01'),
(16, 'IS', 'AquaGuard: Flood Early Warning and Water Level Monitoring System', 'Low-lying communities are vulnerable to sudden flash floods during heavy rainfall. AquaGuard uses ultrasonic sensors mounted on bridges and riverbanks to measure rising water levels continuously. When water reaches critical thresholds, the system triggers sirens and sends SMS alerts to residents and disaster officials.', '• \n	• To build a solar-powered ultrasonic water level sensor node for river monitoring.\n	• To create a web dashboard and automated SMS alert system for disaster response teams.\n	• To measure sensor reliability and alert transmission speed during simulated flood conditions.\n', '• Manual river level monitoring puts barangay officials at risk during severe weather.\n• Delayed warnings leave residents with insufficient time to evacuate safely.\n• Existing weather forecasts lack localized, street-level flood data.', 'Iterative Enhancement Model enables testing of hardware durability in controlled environments before adding SMS and web features.', '', '', 'IoT', '', '2026-11-14 23:36:39'),
(17, 'IT', 'LearnLink: Adaptive E-Learning and Student Performance Analytics Portal', ' Standard learning management systems treat all students identically, regardless of their learning pace. LearnLink analyzes quiz scores and engagement metrics to recommend tailored study materials to struggling students. Teachers use the analytics dashboard to identify at-risk learners early in the semester.', '• \n	• To develop a web-based learning portal with automated performance tracking.\n	• To implement a recommendation engine that suggests remedial resources based on quiz results.\n	• To evaluate whether early intervention alerts improve student passing rates.\n', '• Teachers struggle to identify struggling students in large classes until final exams.\n• Students receive generic study materials that do not address their specific weak areas.\n• Academic coordinators lack aggregated data on course difficulty and student engagement.', 'Agile Methodology supports continuous refinement of the recommendation logic based on educator and student testing.', '', '', '', '', '2026-11-14 23:37:16'),
(18, 'IT', 'TrashSort: Smart Waste Bin with Automated Segregation and Fill-Level Alerts', 'Improper waste disposal clogs drainage systems and reduces recycling efficiency. TrashSort uses inductive, capacitive, and optical sensors to automatically sort waste into biodegradable, recyclable, and residual compartments. Ultrasonic sensors notify janitorial staff via a mobile app when bins reach capacity.', '• To engineer a smart trash bin capable of automatically classifying and sorting common waste types.\n• To develop a mobile app that alerts maintenance crews when bins need emptying.\n• To test the sorting accuracy across various packaging materials and moisture levels.', '• Public trash bins frequently overflow because collection follows fixed schedules rather than actual fill levels.\n• Recyclable materials get contaminated when mixed with wet, biodegradable waste.\n• Manual waste sorting exposes sanitation workers to health hazards.', 'V-Model (Verification and Validation) ensures each sensor and servo motor component is rigorously tested before full system assembly.', '', '', '', '', '2026-11-14 23:37:45'),
(19, 'IT', 'NutriScan: Food Label Reader and Personalized Allergen Alert App', 'Shoppers with food allergies or dietary restrictions spend excessive time reading tiny ingredient labels. NutriScan uses optical character recognition (OCR) via a smartphone camera to scan product barcodes and ingredient lists. The app immediately highlights allergens, high sugar content, or incompatible ingredients based on the user\'s health profile.', '• \n	• To integrate OCR and barcode scanning APIs into a mobile application.\n	• To build a customizable dietary profile engine that flags allergens and nutritional limits.\n	• To evaluate scanning speed and text recognition accuracy across curved or glossy packaging.\n', '• Complex chemical names on food labels confuse consumers with severe allergies.\n• Small font sizes make ingredient lists difficult to read while grocery shopping.\n• Generic calorie-tracking apps rarely check for specific medical allergens or intolerances.', 'Mobile Application Development Lifecycle (MADLC) guides the prototyping, OCR testing, and UI optimization across different phone cameras.', '', '', 'Mobile Development', '', '2026-11-14 23:38:18'),
(20, 'IS', 'DormEase: Student Housing Management and Utility Billing System', 'Dormitory landlords often deal with disputed utility bills, missed rent payments, and unlogged maintenance requests. DormEase automates monthly rent and sub-metered utility calculations while providing tenants a mobile portal to view bills and report room repairs. Landlords gain a centralized dashboard for occupancy tracking and lease renewals.', '• \n	• To automate monthly billing calculations for rent, water, and electricity sub-meters.\n	• To create a tenant mobile portal for viewing invoices, uploading payment receipts, and submitting repair tickets.\n	• To streamline occupancy tracking and lease expiration alerts for property managers.\n', '• \n	• Manual calculation of shared utility bills leads to frequent tenant disputes.\n	• Paper receipts and chat-based payment confirmations are easily lost or disorganized.\n	• Maintenance requests submitted via text messages often get overlooked by staff.', 'Agile Kanban allows continuous delivery of billing, ticketing, and reporting features while visualizing workflow bottlenecks.', '', '', 'Mobile Development', '', '2026-11-14 23:39:01');

SET FOREIGN_KEY_CHECKS = 1;
