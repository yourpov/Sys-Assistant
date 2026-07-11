use crate::error::AppError;
use crate::infrastructure::feedback;

pub async fn submit(kind: String, title: String, description: String) -> Result<(), AppError> {
    feedback::submit_feedback(kind, title, description).await
}