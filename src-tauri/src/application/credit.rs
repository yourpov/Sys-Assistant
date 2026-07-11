use crate::dto::AppCreditDto;
use crate::error::AppError;
use crate::infrastructure::lanyard;

pub async fn fetch_app_credit() -> Result<AppCreditDto, AppError> {
    lanyard::fetch_app_credit().await
}